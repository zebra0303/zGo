import { Router, Request, Response } from "express";
// Use built-in crypto.randomUUID to avoid ESM-only uuid v13 require() failure in CommonJS
import { randomUUID as uuidv4 } from "crypto";
import rateLimit from "express-rate-limit";
import db from "../db";
import {
  requireAdmin,
  signRoomToken,
  verifyRoomToken,
} from "../middleware/auth";

const router = Router();

const VALID_CHARACTERS = ["fox", "cat", "bear", "rabbit", "owl", "tiger"];
const VALID_COLORS = ["BLACK", "WHITE"];

const roomActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many room requests, please try again later." },
});

interface RoomRow {
  id: string;
  status: string;
  board_size: number;
  handicap: number;
  host_nickname: string;
  host_character: string;
  host_color: string;
  guest_nickname: string | null;
  guest_character: string | null;
  moves: string;
  current_player: string;
  undo_host_used: number;
  undo_guest_used: number;
  winner: string | null;
  result_text: string | null;
  created_at: string;
  updated_at: string;
}

// Create a room (admin authenticated + rate-limited)
router.post(
  "/rooms",
  requireAdmin,
  roomActionLimiter,
  (req: Request, res: Response) => {
    const {
      nickname,
      character,
      boardSize = 19,
      handicap = 0,
      hostColor = "BLACK",
    } = req.body ?? {};

    if (
      !nickname ||
      typeof nickname !== "string" ||
      nickname.trim().length === 0 ||
      nickname.trim().length > 20
    ) {
      return res.status(400).json({ error: "Valid nickname is required" });
    }
    if (!character || !VALID_CHARACTERS.includes(character)) {
      return res.status(400).json({ error: "Invalid character" });
    }
    if (!Number.isInteger(boardSize) || boardSize < 5 || boardSize > 19) {
      return res.status(400).json({ error: "Invalid boardSize" });
    }
    if (!Number.isInteger(handicap) || handicap < 0 || handicap > 9) {
      return res.status(400).json({ error: "Invalid handicap" });
    }
    if (typeof hostColor !== "string" || !VALID_COLORS.includes(hostColor)) {
      return res.status(400).json({ error: "Invalid hostColor" });
    }

    const roomId = uuidv4();
    const now = new Date().toISOString();
    const initialPlayer = handicap > 0 ? "WHITE" : "BLACK";

    try {
      db.prepare(
        `INSERT INTO online_rooms (id, status, board_size, handicap, host_nickname, host_character, host_color, current_player, created_at, updated_at)
         VALUES (?, 'waiting', ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        roomId,
        boardSize,
        handicap,
        nickname.trim(),
        character,
        hostColor,
        initialPlayer,
        now,
        now,
      );

      // Sign with explicit type="online_room" so room tokens cannot bypass requireAdmin
      const roomToken = signRoomToken(roomId, "host");

      res.json({ roomId, roomToken });
    } catch {
      res.status(500).json({ error: "Failed to create room" });
    }
  },
);

// Get room info
router.get("/rooms/:id", (req: Request, res: Response) => {
  try {
    const room = db
      .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
      .get(req.params.id) as RoomRow | undefined;

    if (!room) return res.status(404).json({ error: "Room not found" });

    res.json({
      id: room.id,
      status: room.status,
      boardSize: room.board_size,
      handicap: room.handicap,
      hostNickname: room.host_nickname,
      hostCharacter: room.host_character,
      hostColor: room.host_color,
      guestNickname: room.guest_nickname,
      guestCharacter: room.guest_character,
      currentPlayer: room.current_player,
      undoHostUsed: room.undo_host_used === 1,
      undoGuestUsed: room.undo_guest_used === 1,
      winner: room.winner,
      resultText: room.result_text,
      moves: JSON.parse(room.moves),
      createdAt: room.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

// Join a room (atomic status='waiting' update prevents concurrent guest overwrite TOCTOU)
router.post(
  "/rooms/:id/join",
  roomActionLimiter,
  (req: Request, res: Response) => {
    const { nickname, character } = req.body ?? {};

    if (
      !nickname ||
      typeof nickname !== "string" ||
      nickname.trim().length === 0 ||
      nickname.trim().length > 20
    ) {
      return res.status(400).json({ error: "Valid nickname is required" });
    }
    if (!character || !VALID_CHARACTERS.includes(character)) {
      return res.status(400).json({ error: "Invalid character" });
    }

    try {
      const existing = db
        .prepare(`SELECT id, status FROM online_rooms WHERE id = ?`)
        .get(req.params.id) as { id: string; status: string } | undefined;

      if (!existing) return res.status(404).json({ error: "Room not found" });

      const now = new Date().toISOString();
      const result = db
        .prepare(
          `UPDATE online_rooms
           SET guest_nickname = ?, guest_character = ?, status = 'playing', updated_at = ?
           WHERE id = ? AND status = 'waiting'`,
        )
        .run(nickname.trim(), character, now, req.params.id);

      if (result.changes === 0) {
        return res.status(400).json({ error: "Room is not available" });
      }

      const roomToken = signRoomToken(String(req.params.id), "guest");
      res.json({ roomToken });
    } catch {
      res.status(500).json({ error: "Failed to join room" });
    }
  },
);

// Get match record for a room (requires roomToken)
router.get("/rooms/:id/match", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = verifyRoomToken(token);
    if (decoded.roomId !== req.params.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const room = db
      .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
      .get(req.params.id) as RoomRow | undefined;

    if (!room) return res.status(404).json({ error: "Room not found" });

    // Alias created_at to camelCase createdAt to match client ChatMessage contract
    const chatRows = db
      .prepare(
        `SELECT sender, message, created_at AS createdAt FROM online_chat WHERE room_id = ? ORDER BY id`,
      )
      .all(req.params.id);

    res.json({
      room: {
        id: room.id,
        status: room.status,
        boardSize: room.board_size,
        handicap: room.handicap,
        hostNickname: room.host_nickname,
        hostCharacter: room.host_character,
        hostColor: room.host_color,
        guestNickname: room.guest_nickname,
        guestCharacter: room.guest_character,
        moves: JSON.parse(room.moves),
        currentPlayer: room.current_player,
        winner: room.winner,
        resultText: room.result_text,
      },
      chat: chatRows,
    });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
