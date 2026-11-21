import { Router, Request, Response } from "express";
import db from "../db";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// Require admin authentication on all saved match CRUD endpoints
router.use(requireAdmin);

interface MatchBody {
  mode: string;
  aiDifficulty?: number;
  humanColor?: string;
  winner?: string;
  sgfData: string;
}

router.post("/", (req: Request, res: Response) => {
  const { mode, aiDifficulty, humanColor, winner, sgfData } = (req.body ??
    {}) as MatchBody;
  if (typeof mode !== "string" || typeof sgfData !== "string") {
    return res.status(400).json({ error: "mode and sgfData are required" });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO matches (mode, aiDifficulty, humanColor, winner, date, sgfData) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        mode,
        aiDifficulty ?? null,
        humanColor ?? null,
        winner ?? null,
        new Date().toISOString(),
        sgfData,
      );
    res.json({
      id: result.lastInsertRowid,
      message: "Match saved successfully",
    });
  } catch {
    res.status(500).json({ error: "Failed to save match" });
  }
});

router.get("/", (_req: Request, res: Response) => {
  try {
    const rows = db
      .prepare(
        `SELECT id, mode, aiDifficulty, humanColor, winner, date FROM matches ORDER BY id DESC`,
      )
      .all();
    res.json({ matches: rows });
  } catch {
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

router.get("/:id", (req: Request, res: Response) => {
  try {
    const row = db
      .prepare(`SELECT * FROM matches WHERE id = ?`)
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Match not found" });
    res.json({ match: row });
  } catch {
    res.status(500).json({ error: "Failed to fetch match" });
  }
});

router.delete("/:id", (req: Request, res: Response) => {
  try {
    const result = db
      .prepare(`DELETE FROM matches WHERE id = ?`)
      .run(req.params.id);
    if (result.changes === 0)
      return res.status(404).json({ error: "Match not found" });
    res.json({ message: "Match deleted successfully" });
  } catch {
    res.status(500).json({ error: "Failed to delete match" });
  }
});

export default router;
