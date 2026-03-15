import { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import db from "../db";
import {
  getRoom,
  setConnection,
  removeConnection,
  sendToOpponent,
  sendToRoom,
  sendTo,
} from "./roomManager";
import { applyMove, replayMoves, PlayerColor } from "../lib/goLogic";

const JWT_SECRET = process.env.JWT_SECRET || "dev_only_secret";

interface RoomRow {
  id: string;
  status: string;
  board_size: number;
  handicap: number;
  host_color: string;
  moves: string;
  current_player: string;
  undo_host_used: number;
  undo_guest_used: number;
  winner: string | null;
}

interface WsMessage {
  type: string;
  payload?: Record<string, unknown>;
}

export function handleOnlineConnection(ws: WebSocket): void {
  let authenticated = false;
  let roomId: string | null = null;
  let role: "host" | "guest" | null = null;

  // Auto-close if not authenticated within 10s
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      sendTo(ws, {
        type: "error",
        payload: { message: "Authentication timeout" },
      });
      ws.close();
    }
  }, 10000);

  ws.on("message", (data) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return sendTo(ws, {
        type: "error",
        payload: { message: "Invalid JSON" },
      });
    }

    if (!authenticated) {
      if (msg.type === "auth") {
        handleAuth(ws, msg, (r, ro) => {
          clearTimeout(authTimeout);
          authenticated = true;
          roomId = r;
          role = ro;
        });
      } else {
        sendTo(ws, {
          type: "error",
          payload: { message: "Not authenticated" },
        });
      }
      return;
    }

    if (!roomId || !role) return;

    switch (msg.type) {
      case "move":
        handleMove(ws, roomId, role, msg);
        break;
      case "pass":
        handlePass(ws, roomId, role);
        break;
      case "resign":
        handleResign(roomId, role);
        break;
      case "chat":
        handleChat(roomId, role, msg);
        break;
      case "undo_request":
        handleUndoRequest(roomId, role);
        break;
      case "undo_response":
        handleUndoResponse(roomId, role, msg);
        break;
      case "leave":
        handleLeave(roomId, role);
        break;
      default:
        sendTo(ws, {
          type: "error",
          payload: { message: `Unknown type: ${msg.type}` },
        });
    }
  });

  ws.on("close", () => {
    clearTimeout(authTimeout);
    if (roomId && role) {
      // Only process if this WS is still the registered connection for this role
      // (prevents stale connections from removing active ones after reconnect)
      const currentRoom = getRoom(roomId);
      if (currentRoom && currentRoom[role] !== ws) return;

      const room = db
        .prepare(`SELECT status FROM online_rooms WHERE id = ?`)
        .get(roomId) as { status: string } | undefined;

      removeConnection(roomId, role);

      if (room?.status === "finished") {
        // Room was closed (via leave/resign) — tell opponent to exit
        sendToOpponent(roomId, role, {
          type: "room_closed",
          payload: { by: role },
        });
      } else {
        // Temporary disconnect — opponent may reconnect
        sendToOpponent(roomId, role, { type: "opponent_disconnected" });
      }
    }
  });
}

function handleAuth(
  ws: WebSocket,
  msg: WsMessage,
  onSuccess: (roomId: string, role: "host" | "guest") => void,
): void {
  const token = msg.payload?.roomToken as string | undefined;
  if (!token) {
    return sendTo(ws, {
      type: "error",
      payload: { message: "Missing roomToken" },
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      roomId: string;
      role: "host" | "guest";
    };
    const room = db
      .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
      .get(decoded.roomId) as RoomRow | undefined;

    if (!room) {
      return sendTo(ws, {
        type: "error",
        payload: { message: "Room not found" },
      });
    }

    setConnection(decoded.roomId, decoded.role, ws);
    onSuccess(decoded.roomId, decoded.role);

    // Send current room state
    const chatRows = db
      .prepare(
        `SELECT sender, message, created_at FROM online_chat WHERE room_id = ? ORDER BY id`,
      )
      .all(decoded.roomId);

    sendTo(ws, {
      type: "room_state",
      payload: {
        status: room.status,
        moves: JSON.parse(room.moves),
        currentPlayer: room.current_player,
        undoHostUsed: room.undo_host_used === 1,
        undoGuestUsed: room.undo_guest_used === 1,
        winner: room.winner,
        chat: chatRows,
      },
    });

    // Notify opponent of reconnection
    sendToOpponent(decoded.roomId, decoded.role, {
      type: "opponent_reconnected",
    });
  } catch {
    sendTo(ws, { type: "error", payload: { message: "Invalid token" } });
    ws.close();
  }
}

function handleMove(
  ws: WebSocket,
  roomId: string,
  role: "host" | "guest",
  msg: WsMessage,
): void {
  const room = db
    .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
    .get(roomId) as RoomRow | undefined;

  if (!room || room.status !== "playing") {
    return sendTo(ws, {
      type: "error",
      payload: { message: "Game not in progress" },
    });
  }

  // Determine player color from role
  const myColor: PlayerColor =
    role === "host"
      ? (room.host_color as PlayerColor)
      : room.host_color === "BLACK"
        ? "WHITE"
        : "BLACK";

  if (room.current_player !== myColor) {
    return sendTo(ws, { type: "error", payload: { message: "Not your turn" } });
  }

  const x = msg.payload?.x as number;
  const y = msg.payload?.y as number;
  if (typeof x !== "number" || typeof y !== "number") {
    return sendTo(ws, {
      type: "error",
      payload: { message: "Invalid coordinates" },
    });
  }

  // Replay moves to get current board state
  const moves: ({ x: number; y: number } | null)[] = JSON.parse(room.moves);
  const { board, previousBoard } = replayMoves(
    moves,
    room.board_size,
    room.handicap,
  );

  // Validate move
  const result = applyMove(board, x, y, myColor, previousBoard);
  if (!result.isValid) {
    return sendTo(ws, {
      type: "error",
      payload: { message: `Invalid move: ${result.reason}` },
    });
  }

  // Update DB
  moves.push({ x, y });
  const nextPlayer: PlayerColor = myColor === "BLACK" ? "WHITE" : "BLACK";
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE online_rooms SET moves = ?, current_player = ?, updated_at = ? WHERE id = ?`,
  ).run(JSON.stringify(moves), nextPlayer, now, roomId);

  // Broadcast to both players
  sendToRoom(roomId, {
    type: "move",
    payload: { x, y, color: myColor, captured: result.captured },
  });
}

function handlePass(
  ws: WebSocket,
  roomId: string,
  role: "host" | "guest",
): void {
  const room = db
    .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
    .get(roomId) as RoomRow | undefined;

  if (!room || room.status !== "playing") {
    return sendTo(ws, {
      type: "error",
      payload: { message: "Game not in progress" },
    });
  }

  const myColor: PlayerColor =
    role === "host"
      ? (room.host_color as PlayerColor)
      : room.host_color === "BLACK"
        ? "WHITE"
        : "BLACK";

  if (room.current_player !== myColor) {
    return sendTo(ws, { type: "error", payload: { message: "Not your turn" } });
  }

  const moves: ({ x: number; y: number } | null)[] = JSON.parse(room.moves);

  // Check for consecutive passes (game end)
  const lastMove = moves.length > 0 ? moves[moves.length - 1] : undefined;
  const isConsecutivePass = lastMove === null;

  moves.push(null);
  const nextPlayer: PlayerColor = myColor === "BLACK" ? "WHITE" : "BLACK";
  const now = new Date().toISOString();

  if (isConsecutivePass) {
    // Two consecutive passes — game ends, needs scoring
    db.prepare(
      `UPDATE online_rooms SET moves = ?, current_player = ?, status = 'finished', updated_at = ? WHERE id = ?`,
    ).run(JSON.stringify(moves), nextPlayer, now, roomId);

    sendToRoom(roomId, {
      type: "pass",
      payload: { color: myColor },
    });
    sendToRoom(roomId, {
      type: "game_over",
      payload: { reason: "double_pass" },
    });
  } else {
    db.prepare(
      `UPDATE online_rooms SET moves = ?, current_player = ?, updated_at = ? WHERE id = ?`,
    ).run(JSON.stringify(moves), nextPlayer, now, roomId);

    sendToRoom(roomId, {
      type: "pass",
      payload: { color: myColor },
    });
  }
}

function handleResign(roomId: string, role: "host" | "guest"): void {
  const room = db
    .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
    .get(roomId) as RoomRow | undefined;

  if (!room || room.status !== "playing") return;

  const myColor: PlayerColor =
    role === "host"
      ? (room.host_color as PlayerColor)
      : room.host_color === "BLACK"
        ? "WHITE"
        : "BLACK";

  const winnerColor: PlayerColor = myColor === "BLACK" ? "WHITE" : "BLACK";
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE online_rooms SET status = 'finished', winner = ?, result_text = ?, updated_at = ? WHERE id = ?`,
  ).run(winnerColor, `${winnerColor} wins by resignation`, now, roomId);

  sendToRoom(roomId, {
    type: "game_over",
    payload: { winner: winnerColor, reason: "resign", resignedBy: myColor },
  });
}

function handleChat(
  roomId: string,
  role: "host" | "guest",
  msg: WsMessage,
): void {
  const message = msg.payload?.message as string;
  if (!message || typeof message !== "string" || message.trim().length === 0)
    return;

  const trimmed = message.trim().slice(0, 200); // Limit message length
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO online_chat (room_id, sender, message, created_at) VALUES (?, ?, ?, ?)`,
  ).run(roomId, role, trimmed, now);

  sendToRoom(roomId, {
    type: "chat",
    payload: { sender: role, message: trimmed, createdAt: now },
  });
}

function handleUndoRequest(roomId: string, role: "host" | "guest"): void {
  const room = db
    .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
    .get(roomId) as RoomRow | undefined;

  if (!room || room.status !== "playing") return;

  // Check if already used
  const used = role === "host" ? room.undo_host_used : room.undo_guest_used;
  if (used) {
    return; // Already used undo
  }

  sendToOpponent(roomId, role, {
    type: "undo_request",
    payload: { from: role },
  });
}

function handleUndoResponse(
  roomId: string,
  role: "host" | "guest",
  msg: WsMessage,
): void {
  const accepted = msg.payload?.accepted as boolean;
  const requesterRole = role === "host" ? "guest" : "host";

  if (!accepted) {
    sendToOpponent(roomId, role, { type: "undo_rejected" });
    return;
  }

  const room = db
    .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
    .get(roomId) as RoomRow | undefined;

  if (!room || room.status !== "playing") return;

  const moves: ({ x: number; y: number } | null)[] = JSON.parse(room.moves);

  // Remove last 2 moves (requester's move + opponent's response, or just last move if it was requester's turn)
  if (moves.length < 1) return;

  // Remove last 2 moves to undo one full round
  const removeCount = moves.length >= 2 ? 2 : 1;
  moves.splice(moves.length - removeCount, removeCount);

  // Recalculate current player
  const { currentPlayer } = replayMoves(moves, room.board_size, room.handicap);

  // Mark undo as used for the requester
  const undoColumn =
    requesterRole === "host" ? "undo_host_used" : "undo_guest_used";
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE online_rooms SET moves = ?, current_player = ?, ${undoColumn} = 1, updated_at = ? WHERE id = ?`,
  ).run(JSON.stringify(moves), currentPlayer, now, roomId);

  sendToRoom(roomId, {
    type: "undo_accepted",
    payload: { moves, currentPlayer, undoUsedBy: requesterRole },
  });
}

function handleLeave(roomId: string, role: "host" | "guest"): void {
  const now = new Date().toISOString();

  // Mark room as finished
  db.prepare(
    `UPDATE online_rooms SET status = 'finished', updated_at = ? WHERE id = ?`,
  ).run(now, roomId);

  // Notify both players to leave
  sendToRoom(roomId, {
    type: "room_closed",
    payload: { by: role },
  });
}
