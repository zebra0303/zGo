import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

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

// SPA fallback
app.get(/.*/, (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});

// Start KataGo engine
startKataGo();

// Create HTTP server and mount WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = request.url || "";
  if (url.startsWith("/ws/online")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleOnlineConnection(ws);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () =>
  console.log(`Server is running on http://localhost:${PORT}`),
);

// Handle graceful shutdown to prevent KataGo zombie processes
const gracefulShutdown = () => {
  console.log("Shutting down server...");
  stopKataGo();
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", gracefulShutdown); // Triggered by PM2 restart/stop or Ctrl+C
process.on("SIGTERM", gracefulShutdown); // Triggered by docker or standard kill
process.on("exit", () => stopKataGo()); // Fallback for standard process exit

export default app;
