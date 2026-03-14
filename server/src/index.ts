import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";

import { startKataGo } from "./katago/engine";
import aiRouter from "./routes/ai";
import matchesRouter from "./routes/matches";

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

// SPA fallback
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});

// Start KataGo engine
startKataGo();

app.listen(PORT, () =>
  console.log(`Server is running on http://localhost:${PORT}`),
);

export default app;
