import { WebSocket } from "ws";

export interface RoomConnections {
  host: WebSocket | null;
  guest: WebSocket | null;
  // Track pending undo request author so forged undo_response messages cannot undo arbitrarily
  pendingUndoBy: "host" | "guest" | null;
  // Distinguish explicit leave from post-game review disconnect
  explicitlyClosed: boolean;
}

const rooms = new Map<string, RoomConnections>();

export function getRoom(roomId: string): RoomConnections | undefined {
  return rooms.get(roomId);
}

export function setConnection(
  roomId: string,
  role: "host" | "guest",
  ws: WebSocket,
): void {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      host: null,
      guest: null,
      pendingUndoBy: null,
      explicitlyClosed: false,
    };
    rooms.set(roomId, room);
  }
  // Close superseded socket on reconnect to prevent resource leaks
  const previous = room[role];
  if (previous && previous !== ws && previous.readyState === WebSocket.OPEN) {
    previous.close(4000, "Superseded by newer connection");
  }
  room[role] = ws;
}

export function setPendingUndo(
  roomId: string,
  role: "host" | "guest" | null,
): void {
  const room = rooms.get(roomId);
  if (room) {
    room.pendingUndoBy = role;
  }
}

export function markRoomExplicitlyClosed(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.explicitlyClosed = true;
    room.pendingUndoBy = null;
  }
}

export function removeConnection(roomId: string, role: "host" | "guest"): void {
  const room = rooms.get(roomId);
  if (!room) return;
  room[role] = null;
  if (room.pendingUndoBy === role) {
    room.pendingUndoBy = null;
  }
  if (!room.host && !room.guest) {
    rooms.delete(roomId);
  }
}

export function sendToOpponent(
  roomId: string,
  senderRole: "host" | "guest",
  message: object,
): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const opponentRole = senderRole === "host" ? "guest" : "host";
  const opponentWs = room[opponentRole];
  if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
    opponentWs.send(JSON.stringify(message));
  }
}

export function sendToRoom(roomId: string, message: object): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(message);
  if (room.host && room.host.readyState === WebSocket.OPEN) {
    room.host.send(data);
  }
  if (room.guest && room.guest.readyState === WebSocket.OPEN) {
    room.guest.send(data);
  }
}

export function sendTo(ws: WebSocket, message: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
