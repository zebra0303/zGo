import { BoardState } from "@/entities/board/model/types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

export const fetchAIHint = async (
  board: BoardState,
  currentPlayer: string,
  aiDifficulty?: number,
  teacherVisits?: number,
  moves?: ({ x: number; y: number } | null)[],
  signal?: AbortSignal,
  language?: string,
  boardSize?: number,
  handicap?: number,
) => {
  const response = await fetch(`${API_BASE_URL}/ai/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      board,
      currentPlayer,
      isHintRequest: true,
      aiDifficulty,
      teacherVisits,
      moves,
      language,
      boardSize,
      handicap,
    }),
    signal,
  });
  if (!response.ok) throw new Error("Failed to fetch AI hint");
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

export const fetchAIMove = async (
  board: BoardState,
  currentPlayer: string,
  aiDifficulty?: number,
  moves?: ({ x: number; y: number } | null)[],
  signal?: AbortSignal,
  language?: string,
  boardSize?: number,
  handicap?: number,
) => {
  const response = await fetch(`${API_BASE_URL}/ai/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      board,
      currentPlayer,
      isHintRequest: false,
      aiDifficulty,
      moves,
      language,
      boardSize,
      handicap,
    }),
    signal,
  });
  if (!response.ok) throw new Error("Failed to fetch AI move");
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

export const fetchAIScore = async (
  moves: ({ x: number; y: number } | null)[],
  boardSize?: number,
  handicap?: number,
) => {
  const response = await fetch(`${API_BASE_URL}/ai/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moves, boardSize, handicap }),
  });
  if (!response.ok) throw new Error("Failed to fetch AI score");
  return response.json();
};

export const saveMatch = async (matchData: Record<string, unknown>) => {
  const response = await fetch(`${API_BASE_URL}/matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(matchData),
  });
  if (!response.ok) throw new Error("Failed to save match");
  return response.json();
};

export const getMatches = async () => {
  const response = await fetch(`${API_BASE_URL}/matches`);
  if (!response.ok) throw new Error("Failed to fetch matches");
  return response.json();
};

export const getMatchById = async (id: string | number) => {
  const response = await fetch(`${API_BASE_URL}/matches/${id}`);
  if (!response.ok) throw new Error("Failed to fetch match details");
  return response.json();
};

export const deleteMatch = async (id: string | number) => {
  const response = await fetch(`${API_BASE_URL}/matches/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete match");
  return response.json();
};
