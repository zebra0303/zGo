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
      // .html, .webmanifest, and unhashed service worker scripts should not be cached
      if (
        filePath.endsWith(".html") ||
        filePath.endsWith(".webmanifest") ||
        filePath.endsWith("sw.js") ||
        filePath.endsWith("registerSW.js")
      ) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else {
        // Hashed assets (CSS, JS, images) can be cached safely for a year
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
    // If it's a missing asset file (e.g. .css, .js, .png that wasn't found by express.static),
    // return a proper 404 response instead of falling through to default Express HTML 404.
    return res.status(404).type("text/plain").send("Not Found");
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
