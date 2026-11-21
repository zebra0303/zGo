import { WebSocket } from "ws";
import db from "../db";
import { verifyRoomToken } from "../middleware/auth";
import {
  getRoom,
  setConnection,
  setPendingUndo,
  markRoomExplicitlyClosed,
  removeConnection,
  sendToOpponent,
  sendToRoom,
  sendTo,
} from "./roomManager";
import { applyMove, replayMoves, PlayerColor } from "../lib/goLogic";

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

const CHAT_RATE_WINDOW_MS = 10_000;
const CHAT_RATE_MAX = 15;

export function handleOnlineConnection(ws: WebSocket): void {
  let authenticated = false;
  let roomId: string | null = null;
  let role: "host" | "guest" | null = null;
  let chatTimestamps: number[] = [];

  // Prevent unhandled socket error events from crashing the Node process
  ws.on("error", (err) => {
    console.warn("WebSocket error:", err.message);
  });

  // Auto-close if not authenticated within 10s
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      sendTo(ws, {
        type: "error",
        payload: { message: "Authentication timeout" },
      });
      ws.close(4001, "Authentication timeout");
    }
  }, 10000);

  ws.on("message", (data) => {
    try {
      let msg: WsMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return sendTo(ws, {
          type: "error",
          payload: { message: "Invalid JSON" },
        });
      }

      if (!msg || typeof msg !== "object" || typeof msg.type !== "string") {
        return sendTo(ws, {
          type: "error",
          payload: { message: "Invalid message format" },
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
        case "chat": {
          const now = Date.now();
          chatTimestamps = chatTimestamps.filter(
            (ts) => now - ts < CHAT_RATE_WINDOW_MS,
          );
          if (chatTimestamps.length >= CHAT_RATE_MAX) {
            sendTo(ws, {
              type: "error",
              payload: { message: "Chat rate limit exceeded" },
            });
            break;
          }
          chatTimestamps.push(now);
          handleChat(roomId, role, msg);
          break;
        }
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
    } catch (err) {
      // Catch unexpected errors inside message handler so malformed payloads never crash the server
      console.error("WS message dispatch error:", err);
      sendTo(ws, {
        type: "error",
        payload: { message: "Internal message processing error" },
      });
    }
  });

  ws.on("close", () => {
    clearTimeout(authTimeout);
    if (roomId && role) {
      const currentRoom = getRoom(roomId);
      if (currentRoom && currentRoom[role] !== ws) return;
      const wasExplicitlyClosed = currentRoom?.explicitlyClosed ?? false;

      const room = db
        .prepare(`SELECT status FROM online_rooms WHERE id = ?`)
        .get(roomId) as { status: string } | undefined;

      removeConnection(roomId, role);

      // Avoid emitting duplicate room_closed after handleLeave or during post-game review
      if (!wasExplicitlyClosed && room?.status !== "finished") {
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
  const token = msg.payload?.roomToken;
  if (typeof token !== "string" || !token) {
    return sendTo(ws, {
      type: "error",
      payload: { message: "Missing roomToken" },
    });
  }

  try {
    const decoded = verifyRoomToken(token);
    const room = db
      .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
      .get(decoded.roomId) as RoomRow | undefined;

    if (!room) {
      sendTo(ws, {
        type: "error",
        payload: { message: "Room not found" },
      });
      ws.close(4004, "Room not found");
      return;
    }

    setConnection(decoded.roomId, decoded.role, ws);
    onSuccess(decoded.roomId, decoded.role);

    // Alias created_at to createdAt so client displays valid timestamps on reconnect
    const chatRows = db
      .prepare(
        `SELECT sender, message, created_at AS createdAt FROM online_chat WHERE room_id = ? ORDER BY id`,
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

    sendToOpponent(decoded.roomId, decoded.role, {
      type: "opponent_reconnected",
    });
  } catch {
    sendTo(ws, { type: "error", payload: { message: "Invalid token" } });
    ws.close(4001, "Invalid token");
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

  const myColor: PlayerColor =
    role === "host"
      ? (room.host_color as PlayerColor)
      : room.host_color === "BLACK"
        ? "WHITE"
        : "BLACK";

  if (room.current_player !== myColor) {
    return sendTo(ws, { type: "error", payload: { message: "Not your turn" } });
  }

  // Strictly validate integer bounds so fractional/NaN coordinates cannot crash goLogic
  const x = msg.payload?.x;
  const y = msg.payload?.y;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x >= room.board_size ||
    y < 0 ||
    y >= room.board_size
  ) {
    return sendTo(ws, {
      type: "error",
      payload: { message: "Invalid coordinates" },
    });
  }

  const moves: ({ x: number; y: number } | null)[] = JSON.parse(room.moves);
  const { board, previousBoard } = replayMoves(
    moves,
    room.board_size,
    room.handicap,
  );

  const result = applyMove(board, x, y, myColor, previousBoard);
  if (!result.isValid) {
    return sendTo(ws, {
      type: "error",
      payload: { message: `Invalid move: ${result.reason}` },
    });
  }

  // Clear any stale pending undo when gameplay advances
  setPendingUndo(roomId, null);

  moves.push({ x, y });
  const nextPlayer: PlayerColor = myColor === "BLACK" ? "WHITE" : "BLACK";
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE online_rooms SET moves = ?, current_player = ?, updated_at = ? WHERE id = ?`,
  ).run(JSON.stringify(moves), nextPlayer, now, roomId);

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

  setPendingUndo(roomId, null);

  const moves: ({ x: number; y: number } | null)[] = JSON.parse(room.moves);
  const lastMove = moves.length > 0 ? moves[moves.length - 1] : undefined;
  const isConsecutivePass = lastMove === null;

  moves.push(null);
  const nextPlayer: PlayerColor = myColor === "BLACK" ? "WHITE" : "BLACK";
  const now = new Date().toISOString();

  if (isConsecutivePass) {
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

  setPendingUndo(roomId, null);

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
  const message = msg.payload?.message;
  if (typeof message !== "string" || message.trim().length === 0) return;

  const trimmed = message.trim().slice(0, 200);
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

  const used = role === "host" ? room.undo_host_used : room.undo_guest_used;
  if (used) return;

  // Record requester in room state so handleUndoResponse can verify legitimacy
  setPendingUndo(roomId, role);

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
  const accepted = msg.payload?.accepted === true;
  const requesterRole = role === "host" ? "guest" : "host";

  // Verify an actual pending undo request exists from the opponent (prevents arbitrary forced undos)
  const memRoom = getRoom(roomId);
  if (!memRoom || memRoom.pendingUndoBy !== requesterRole) {
    return;
  }
  setPendingUndo(roomId, null);

  if (!accepted) {
    sendToOpponent(roomId, role, { type: "undo_rejected" });
    return;
  }

  const room = db
    .prepare(`SELECT * FROM online_rooms WHERE id = ?`)
    .get(roomId) as RoomRow | undefined;

  if (!room || room.status !== "playing") return;

  const alreadyUsed =
    requesterRole === "host" ? room.undo_host_used : room.undo_guest_used;
  if (alreadyUsed) return;

  const moves: ({ x: number; y: number } | null)[] = JSON.parse(room.moves);
  if (moves.length < 1) return;

  const removeCount = moves.length >= 2 ? 2 : 1;
  moves.splice(moves.length - removeCount, removeCount);

  const { currentPlayer } = replayMoves(moves, room.board_size, room.handicap);

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

  markRoomExplicitlyClosed(roomId);

  db.prepare(
    `UPDATE online_rooms SET status = 'finished', updated_at = ? WHERE id = ?`,
  ).run(now, roomId);

  sendToRoom(roomId, {
    type: "room_closed",
    payload: { by: role },
  });
}
