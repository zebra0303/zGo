import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";

import { startKataGo } from "./katago/engine";
import aiRouter from "./routes/ai";
import matchesRouter from "./routes/matches";
import settingsRouter from "./routes/settings";
import onlineRouter from "./routes/online";
import { handleOnlineConnection } from "./ws/onlineHandler";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static React client files in production
app.use(express.static(path.join(__dirname, "../../client/dist")));

// Routes
app.use("/api/ai", aiRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/online", onlineRouter);

// SPA fallback
app.get(/.*/, (_req, res) => {
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

export default app;
