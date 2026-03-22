// 1. Load environment variables immediately and synchronously
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

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
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import cookieParser from "cookie-parser";

import { startKataGo, stopKataGo } from "./katago/engine";
import aiRouter from "./routes/ai";
import matchesRouter from "./routes/matches";
import settingsRouter from "./routes/settings";
import onlineRouter from "./routes/online";
import { handleOnlineConnection } from "./ws/onlineHandler";

const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use(
  express.static(path.join(__dirname, "../../client/dist"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
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

// SPA fallback: Use a pure regex literal to avoid path-to-regexp string parsing issues in Express 5
// This matches everything except paths starting with /api
app.get(/^(?!\/api).+/, (req, res, next) => {
  if (req.path.includes(".")) {
    return next();
  }
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});

try {
  startKataGo();
} catch (err) {
  console.error("Failed to start KataGo on startup:", err);
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  handleOnlineConnection(ws);
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  stopKataGo();
  server.close(() => {
    process.exit(0);
  });
});
