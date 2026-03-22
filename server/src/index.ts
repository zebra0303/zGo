import "./loadEnv"; // Must be first to ensure env vars are loaded before other modules

import express from "express";
import cors from "cors";
import path from "path";
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

// Trust the first proxy (e.g. Nginx) to let express-rate-limit get correct IP
app.set("trust proxy", 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Serve static React client files in production
app.use(
  express.static(path.join(__dirname, "../../client/dist"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else {
        // Cache static assets (JS, CSS, images) for 1 year since Vite hashes them
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }),
);

// Routes
app.use("/api/ai", aiRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/online", onlineRouter);

// SPA fallback: Only serve index.html for navigation requests that are not API calls or static files
// Express 5 / path-to-regexp v8 requires named parameters with regex (e.g., :any(.*)) instead of bare '*'
app.get("/:any(.*)", (req, res, next) => {
  // If it's an API call or has a file extension, don't serve index.html
  if (req.path.startsWith("/api") || req.path.includes(".")) {
    return next();
  }
  res.setHeader("Cache-Control", "no-cache, no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});

// Start KataGo engine
try {
  startKataGo();
} catch (err) {
  console.error("Failed to start KataGo on startup:", err);
}

const server = http.createServer(app);

// WebSocket setup
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  handleOnlineConnection(ws);
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down...");
  stopKataGo();
  server.close(() => {
    process.exit(0);
  });
});
