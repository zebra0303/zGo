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

router.post("/", (req: Request, res: Response) => {
  const { mode, aiDifficulty, humanColor, winner, sgfData } =
    req.body as MatchBody;
  const stmt = db.prepare(
    `INSERT INTO matches (mode, aiDifficulty, humanColor, winner, date, sgfData) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  stmt.run(
    [mode, aiDifficulty, humanColor, winner, new Date().toISOString(), sgfData],
    function (this: { lastID: number }, err: Error | null) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: "Match saved successfully" });
    },
  );
  stmt.finalize();
});

router.get("/", (_req: Request, res: Response) => {
  db.all(
    `SELECT id, mode, aiDifficulty, humanColor, winner, date FROM matches ORDER BY id DESC`,
    [],
    (err: Error | null, rows: unknown[]) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ matches: rows });
    },
  );
});

router.get("/:id", (req: Request, res: Response) => {
  db.get(
    `SELECT * FROM matches WHERE id = ?`,
    [req.params.id],
    (err: Error | null, row: unknown) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Match not found" });
      res.json({ match: row });
    },
  );
});

router.delete("/:id", (req: Request, res: Response) => {
  const stmt = db.prepare(`DELETE FROM matches WHERE id = ?`);
  stmt.run(
    [req.params.id],
    function (this: { changes: number }, err: Error | null) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Match not found" });
      res.json({ message: "Match deleted successfully" });
    },
  );
  stmt.finalize();
});

export default router;
