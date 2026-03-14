import { BoardState } from "@/entities/board/model/types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1")
    ? "http://localhost:3001/api"
    : "/api");

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

export const analyzeGame = async (
  moves: ({ x: number; y: number } | null)[],
  boardSize: number,
  handicap: number,
  onProgress: (moveIndex: number, winRate: number) => void,
  signal?: AbortSignal,
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/ai/analyze-game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moves, boardSize, handicap }),
    signal,
  });
  if (!response.ok) throw new Error("Failed to start analysis");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.done) return;
          if (data.error) throw new Error(data.error);
          if (typeof data.moveIndex === "number" && typeof data.winRate === "number") {
            onProgress(data.moveIndex, data.winRate);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  }
};

export const deleteMatch = async (id: string | number) => {
  const response = await fetch(`${API_BASE_URL}/matches/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete match");
  return response.json();
};
