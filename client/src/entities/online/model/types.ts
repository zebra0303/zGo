export type CharacterType = "fox" | "cat" | "bear" | "rabbit" | "owl" | "tiger";

export const CHARACTERS: { id: CharacterType; emoji: string; label: string }[] =
  [
    { id: "fox", emoji: "🦊", label: "Fox" },
    { id: "cat", emoji: "🐱", label: "Cat" },
    { id: "bear", emoji: "🐻", label: "Bear" },
    { id: "rabbit", emoji: "🐰", label: "Rabbit" },
    { id: "owl", emoji: "🦉", label: "Owl" },
    { id: "tiger", emoji: "🐯", label: "Tiger" },
  ];

export interface ChatMessage {
  sender: "host" | "guest";
  message: string;
  createdAt: string;
}

export interface RoomInfo {
  id: string;
  status: "waiting" | "playing" | "finished";
  boardSize: number;
  handicap: number;
  hostNickname: string;
  hostCharacter: CharacterType;
  hostColor: "BLACK" | "WHITE";
  guestNickname: string | null;
  guestCharacter: CharacterType | null;
  currentPlayer: "BLACK" | "WHITE";
  undoHostUsed: boolean;
  undoGuestUsed: boolean;
  winner: "BLACK" | "WHITE" | null;
  resultText: string | null;
  moves: ({ x: number; y: number } | null)[];
  createdAt: string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
