import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import db from "../db";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_only_secret";

const VALID_CHARACTERS = ["fox", "cat", "bear", "rabbit", "owl", "tiger"];

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

// Create a room
router.post("/rooms", (req: Request, res: Response) => {
  const {
    nickname,
    character,
    boardSize = 19,
    handicap = 0,
    hostColor = "BLACK",
  } = req.body;

  if (
    !nickname ||
    typeof nickname !== "string" ||
    nickname.trim().length === 0
  ) {
    return res.status(400).json({ error: "Nickname is required" });
  }
  if (!character || !VALID_CHARACTERS.includes(character)) {
    return res.status(400).json({ error: "Invalid character" });
  }

  const roomId = uuidv4();
  const now = new Date().toISOString();

  try {
    db.prepare(
      `INSERT INTO online_rooms (id, status, board_size, handicap, host_nickname, host_character, host_color, current_player, created_at, updated_at)
       VALUES (?, 'waiting', ?, ?, ?, ?, ?, 'BLACK', ?, ?)`,
    ).run(
      roomId,
      boardSize,
      handicap,
      nickname.trim(),
      character,
      hostColor,
      now,
      now,
    );

    const roomToken = jwt.sign({ roomId, role: "host" }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({ roomId, roomToken });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

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
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Join a room
router.post("/rooms/:id/join", (req: Request, res: Response) => {
  const { nickname, character } = req.body;

  if (
    !nickname ||
    typeof nickname !== "string" ||
    nickname.trim().length === 0
  ) {
    return res.status(400).json({ error: "Nickname is required" });
  }
  if (!character || !VALID_CHARACTERS.includes(character)) {
    return res.status(400).json({ error: "Invalid character" });
  }

  try {
    const room = db
      .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
      .get(req.params.id) as RoomRow | undefined;

    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.status !== "waiting") {
      return res.status(400).json({ error: "Room is not available" });
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE online_rooms SET guest_nickname = ?, guest_character = ?, status = 'playing', updated_at = ? WHERE id = ?`,
    ).run(nickname.trim(), character, now, req.params.id);

    const roomToken = jwt.sign(
      { roomId: req.params.id, role: "guest" },
      JWT_SECRET,
      {
        expiresIn: "24h",
      },
    );

    res.json({ roomToken });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get match record for a room (requires roomToken)
router.get("/rooms/:id/match", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as {
      roomId: string;
      role: string;
    };
    if (decoded.roomId !== req.params.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const room = db
      .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
      .get(req.params.id) as RoomRow | undefined;

    if (!room) return res.status(404).json({ error: "Room not found" });

    const chatRows = db
      .prepare(
        `SELECT sender, message, created_at FROM online_chat WHERE room_id = ? ORDER BY id`,
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
