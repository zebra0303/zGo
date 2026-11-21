import { BoardState } from "@/shared/types/board";
import { ApiError as AppError, createMaskedError } from "@zebra/core";

// Use pure environment variables for API URL (no hardcoded fallback logic)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// Track active online room token so guest players can call authorized scoring/analysis endpoints
let onlineRoomToken: string | null = null;

export const setOnlineRoomToken = (token: string | null): void => {
  onlineRoomToken = token;
};

// Custom fetch wrapper to always include cookies
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  return fetch(url, {
    ...options,
    credentials: "include", // Always send HttpOnly cookies
  });
};

const getAiAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (onlineRoomToken) {
    headers.Authorization = `Bearer ${onlineRoomToken}`;
  }
  return headers;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleApiResponse = async (response: Response): Promise<any> => {
  // Read body once to avoid TypeError from consuming the stream twice
  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    let errorData = rawText || "Unknown Server Error";
    if (parsed && typeof parsed === "object") {
      const obj = parsed as {
        error?: string | { message?: string };
        message?: string;
      };
      if (typeof obj.error === "string" && obj.error) {
        errorData = obj.error;
      } else if (
        obj.error &&
        typeof obj.error === "object" &&
        typeof obj.error.message === "string"
      ) {
        errorData = obj.error.message;
      } else if (typeof obj.message === "string" && obj.message) {
        errorData = obj.message;
      }
    }

    // Mask sensitive 5xx errors from the server
    if (response.status >= 500) {
      throw new AppError(
        "Service is temporarily unavailable.",
        response.status,
        { code: "SERVER_ERROR" },
      );
    }

    throw new AppError(errorData, response.status, { code: "API_ERROR" });
  }

  return parsed ?? {};
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
    const response = await fetchWithAuth(`${API_BASE_URL}/ai/move`, {
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
    const response = await fetchWithAuth(`${API_BASE_URL}/ai/move`, {
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
    const response = await fetchWithAuth(`${API_BASE_URL}/ai/score`, {
      method: "POST",
      headers: getAiAuthHeaders(),
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
    const response = await fetchWithAuth(`${API_BASE_URL}/matches`, {
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
    const response = await fetchWithAuth(`${API_BASE_URL}/matches`);
    return await handleApiResponse(response);
  } catch (error) {
    throw createMaskedError(error, "Failed to fetch matches.");
  }
};

export const getMatchById = async (id: string | number) => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/matches/${id}`);
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
    response = await fetchWithAuth(`${API_BASE_URL}/ai/analyze-game`, {
      method: "POST",
      headers: getAiAuthHeaders(),
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
    throw new AppError("No response body stream available.", 500, {
      code: "STREAM_ERROR",
    });
  const decoder = new TextDecoder();
  let buffer = "";

  const CHUNK_TIMEOUT = 30_000; // 30s per chunk before giving up
  try {
    while (true) {
      const readPromise = reader.read();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new AppError("Analysis timed out.", 408, { code: "TIMEOUT" }),
            ),
          CHUNK_TIMEOUT,
        );
      });

      try {
        const { done, value } = await Promise.race([
          readPromise,
          timeoutPromise,
        ]);
        if (timeoutId) clearTimeout(timeoutId);
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        throw e;
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) return;
            if (data.error)
              throw new AppError(data.error, 500, { code: "ANALYSIS_ERROR" });
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
  } finally {
    // Always cancel and release stream reader to prevent dangling SSE connections
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }
};

export const deleteMatch = async (id: string | number) => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/matches/${id}`, {
      method: "DELETE",
    });
    return await handleApiResponse(response);
  } catch (error) {
    throw createMaskedError(error, "Failed to delete match.");
  }
};

export const restartEngine = async () => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/ai/restart`, {
      method: "POST",
    });
    return await handleApiResponse(response);
  } catch (error) {
    throw createMaskedError(error, "Failed to restart AI engine.");
  }
};
