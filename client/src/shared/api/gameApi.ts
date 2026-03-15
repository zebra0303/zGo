import { BoardState } from "@/shared/types/board";
import { AppError, createMaskedError } from "@/shared/lib/errors/AppError";

// Use pure environment variables for API URL (no hardcoded fallback logic)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const handleApiResponse = async (response: Response) => {
  if (!response.ok) {
    let errorData = "Unknown Server Error";
    try {
      const data = await response.json();
      errorData = data.error || data.message || errorData;
    } catch {
      // Not JSON
      errorData = await response.text();
    }

    // Mask sensitive 5xx errors from the server
    if (response.status >= 500) {
      throw new AppError(
        "Service is temporarily unavailable.",
        response.status,
        "SERVER_ERROR",
      );
    }

    throw new AppError(errorData, response.status, "API_ERROR");
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

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
  try {
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
    return await handleApiResponse(response);
  } catch (error) {
    throw createMaskedError(error, "Failed to fetch AI hint.");
  }
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
  try {
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
    return await handleApiResponse(response);
  } catch (error) {
    throw createMaskedError(error, "Failed to fetch AI move.");
  }
};

export const fetchAIScore = async (
  moves: ({ x: number; y: number } | null)[],
  boardSize?: number,
  handicap?: number,
  signal?: AbortSignal,
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moves, boardSize, handicap }),
      signal,
    });
    return await handleApiResponse(response);
  } catch (error) {
    throw createMaskedError(error, "Failed to fetch AI score.");
  }
};

export const saveMatch = async (matchData: Record<string, unknown>) => {
  try {
    const response = await fetch(`${API_BASE_URL}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchData),
    });
    return await handleApiResponse(response);
  } catch (error) {
    throw createMaskedError(error, "Failed to save match data.");
  }
};

export const getMatches = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/matches`);
    return await handleApiResponse(response);
  } catch (error) {
    throw createMaskedError(error, "Failed to fetch matches.");
  }
};

export const getMatchById = async (id: string | number) => {
  try {
    const response = await fetch(`${API_BASE_URL}/matches/${id}`);
    return await handleApiResponse(response);
  } catch (error) {
    throw createMaskedError(error, "Failed to fetch match details.");
  }
};

export const analyzeGame = async (
  moves: ({ x: number; y: number } | null)[],
  boardSize: number,
  handicap: number,
  onProgress: (moveIndex: number, winRate: number) => void,
  signal?: AbortSignal,
): Promise<void> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/ai/analyze-game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moves, boardSize, handicap }),
      signal,
    });
  } catch (error) {
    throw createMaskedError(error, "Failed to connect for analysis.");
  }

  if (!response.ok) {
    // Attempt to mask error via handleApiResponse which will throw
    await handleApiResponse(response);
  }

  const reader = response.body?.getReader();
  if (!reader)
    throw new AppError(
      "No response body stream available.",
      500,
      "STREAM_ERROR",
    );
  const decoder = new TextDecoder();
  let buffer = "";

  const CHUNK_TIMEOUT = 30_000; // 30s per chunk before giving up
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const readPromise = reader.read();
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new AppError("Analysis timed out.", 408, "TIMEOUT")),
          CHUNK_TIMEOUT,
        ),
      );
      const { done, value } = await Promise.race([readPromise, timeout]);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) return;
            if (data.error)
              throw new AppError(data.error, 500, "ANALYSIS_ERROR");
            if (
              typeof data.moveIndex === "number" &&
              typeof data.winRate === "number"
            ) {
              onProgress(data.moveIndex, data.winRate);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
  } catch (error) {
    throw createMaskedError(error, "Analysis stream interrupted.");
  }
};

export const deleteMatch = async (id: string | number) => {
  try {
    const response = await fetch(`${API_BASE_URL}/matches/${id}`, {
      method: "DELETE",
    });
    return await handleApiResponse(response);
  } catch (error) {
    throw createMaskedError(error, "Failed to delete match.");
  }
};
