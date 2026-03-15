import { WebSocket } from "ws";

interface RoomConnections {
  host: WebSocket | null;
  guest: WebSocket | null;
}

// In-memory map of active WebSocket connections per room
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
    room = { host: null, guest: null };
    rooms.set(roomId, room);
  }
  room[role] = ws;
}

export function removeConnection(roomId: string, role: "host" | "guest"): void {
  const room = rooms.get(roomId);
  if (!room) return;
  room[role] = null;
  // Clean up if both disconnected
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
