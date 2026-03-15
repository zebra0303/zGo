import { Router, Request, Response } from "express";
import db from "../db";

const router = Router();

interface MatchBody {
  mode: string;
  aiDifficulty?: number;
  humanColor?: string;
  winner?: string;
  sgfData: string;
}

// refactor: migrated from sqlite3 callbacks to better-sqlite3 sync API
router.post("/", (req: Request, res: Response) => {
  const { mode, aiDifficulty, humanColor, winner, sgfData } =
    req.body as MatchBody;
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
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
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
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/:id", (req: Request, res: Response) => {
  try {
    const row = db
      .prepare(`SELECT * FROM matches WHERE id = ?`)
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Match not found" });
    res.json({ match: row });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
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
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
