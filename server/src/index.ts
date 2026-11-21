// 1. Load environment variables synchronously before static imports read process.env
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
/* eslint-enable @typescript-eslint/no-require-imports */

const envPaths = [
  path.resolve(__dirname, "../../.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "server/.env"),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`Loaded environment variables from: ${envPath}`);
    break;
  }
}

// 2. Import other modules
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import { WebSocketServer } from "ws";
import cookieParser from "cookie-parser";
import { AppError } from "@zebra/core/server";
import { createCorsDelegate } from "./middleware/cors";

import db from "./db";
import { startKataGo, stopKataGo } from "./katago/engine";
import aiRouter from "./routes/ai";
import matchesRouter from "./routes/matches";
import settingsRouter from "./routes/settings";
import onlineRouter from "./routes/online";
import { handleOnlineConnection } from "./ws/onlineHandler";

const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);

// Add security headers (CSP relaxed for inline styles/fonts/PWA assets)
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

// Allow same-origin requests automatically behind reverse proxies while restricting cross-origin via allowlist
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : [
      `http://localhost:${process.env.VITE_PORT || 5550}`,
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${process.env.VITE_PORT || 5550}`,
      `http://127.0.0.1:${PORT}`,
    ];

app.use(cors(createCorsDelegate(allowedOrigins)));

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.use(
  express.static(path.join(__dirname, "../../client/dist"), {
    setHeaders: (res, filePath) => {
      if (
        filePath.endsWith(".html") ||
        filePath.endsWith(".webmanifest") ||
        filePath.endsWith("sw.js") ||
        filePath.endsWith("registerSW.js")
      ) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }),
);

app.use("/api/ai", aiRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/online", onlineRouter);

app.get(/^(?!\/api).+/, (req, res) => {
  if (req.path.includes(".")) {
    return res.status(404).type("text/plain").send("Not Found");
  }
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});

// Global Express 5 error handler prevents stack trace leaks
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error("[Server Error]", err);
  return res.status(500).json({ error: "Internal server error" });
});

try {
  startKataGo();
} catch (err) {
  console.error("Failed to start KataGo on startup:", err);
}

const server = http.createServer(app);
// Bound WebSocket payload size to prevent memory exhaustion DoS
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
wss.on("connection", (ws) => {
  handleOnlineConnection(ws);
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Trap both SIGINT and SIGTERM so KataGo, WS, and SQLite WAL shut down cleanly
function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down zGo server...`);
  stopKataGo();
  wss.close();
  server.close(() => {
    try {
      db.close();
    } catch {
      /* ignore close errors */
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
