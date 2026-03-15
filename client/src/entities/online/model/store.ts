import { create } from "zustand";
import {
  ChatMessage,
  CharacterType,
  ConnectionStatus,
  RoomInfo,
} from "./types";
import * as wsClient from "@/features/online/lib/wsClient";
import {
  useGameStore,
  startReviewAnalysis,
} from "@/entities/match/model/store";
import {
  playStoneSound,
  playWinSound,
  playLoseSound,
} from "@/shared/lib/sound";
import { saveMatch, fetchAIScore } from "@/shared/api/gameApi";
import { PlayerColor } from "@/shared/types/board";

interface OnlineState {
  // Connection
  roomId: string | null;
  roomToken: string | null;
  connectionStatus: ConnectionStatus;

  // Room info
  roomInfo: RoomInfo | null;
  myRole: "host" | "guest" | null;
  myNickname: string;
  myCharacter: CharacterType | null;

  // Undo
  pendingUndoRequest: "sent" | "received" | null;

  // Notification (shown briefly to user)
  notification: string | null;

  // Chat
  chatMessages: ChatMessage[];

  // Actions
  createRoom: (
    nickname: string,
    character: CharacterType,
    boardSize: number,
    handicap: number,
    hostColor: "BLACK" | "WHITE",
  ) => Promise<string>;
  joinRoom: (
    roomId: string,
    nickname: string,
    character: CharacterType,
  ) => Promise<void>;
  connectWs: (roomId: string, roomToken: string) => void;
  disconnectWs: () => void;
  sendMove: (x: number, y: number) => void;
  sendPass: () => void;
  sendResign: () => void;
  sendLeave: () => void;
  sendChat: (message: string) => void;
  requestUndo: () => void;
  respondUndo: (accepted: boolean) => void;
  setRoomInfo: (info: RoomInfo | null) => void;
  setNotification: (msg: string | null) => void;
  restoreSession: () => boolean;
  reset: () => void;
}

import { API_BASE_URL as API_BASE } from "@/shared/api/gameApi";

// Session persistence helpers
const SESSION_KEY = "zgo_online_session";

interface SessionData {
  roomId: string;
  roomToken: string;
  myRole: "host" | "guest";
  myNickname: string;
  myCharacter: CharacterType;
}

function saveSession(data: SessionData): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

function loadSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

const initialState = {
  roomId: null as string | null,
  roomToken: null as string | null,
  connectionStatus: "disconnected" as ConnectionStatus,
  roomInfo: null as RoomInfo | null,
  myRole: null as "host" | "guest" | null,
  myNickname: "",
  myCharacter: null as CharacterType | null,
  pendingUndoRequest: null as "sent" | "received" | null,
  notification: null as string | null,
  chatMessages: [] as ChatMessage[],
};

export const useOnlineStore = create<OnlineState>((set, get) => ({
  ...initialState,

  createRoom: async (nickname, character, boardSize, handicap, hostColor) => {
    const res = await fetch(`${API_BASE}/online/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname,
        character,
        boardSize,
        handicap,
        hostColor,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create room");
    }
    const { roomId, roomToken } = await res.json();

    set({
      roomId,
      roomToken,
      myRole: "host",
      myNickname: nickname,
      myCharacter: character,
    });

    saveSession({
      roomId,
      roomToken,
      myRole: "host",
      myNickname: nickname,
      myCharacter: character,
    });
    return roomId;
  },

  joinRoom: async (roomId, nickname, character) => {
    const res = await fetch(`${API_BASE}/online/rooms/${roomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, character }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to join room");
    }
    const { roomToken } = await res.json();

    set({
      roomId,
      roomToken,
      myRole: "guest",
      myNickname: nickname,
      myCharacter: character,
    });

    saveSession({
      roomId,
      roomToken,
      myRole: "guest",
      myNickname: nickname,
      myCharacter: character,
    });
  },

  connectWs: (roomId, roomToken) => {
    // Set up message handler
    wsClient.onMessage((msg) => {
      const state = get();
      handleWsMessage(msg, state, set);
    });

    wsClient.onStatusChange((status) => {
      set({ connectionStatus: status });
    });

    wsClient.connect(roomId, roomToken);
  },

  disconnectWs: () => {
    wsClient.disconnect();
    set({ connectionStatus: "disconnected" });
  },

  sendMove: (x, y) => {
    wsClient.send("move", { x, y });
  },

  sendPass: () => {
    wsClient.send("pass");
  },

  sendResign: () => {
    wsClient.send("resign");
  },

  sendLeave: () => {
    wsClient.send("leave");
  },

  sendChat: (message) => {
    wsClient.send("chat", { message });
  },

  requestUndo: () => {
    wsClient.send("undo_request");
    set({ pendingUndoRequest: "sent" });
  },

  respondUndo: (accepted) => {
    wsClient.send("undo_response", { accepted });
    set({ pendingUndoRequest: null });
  },

  setRoomInfo: (info) => set({ roomInfo: info }),

  setNotification: (msg) => set({ notification: msg }),

  restoreSession: () => {
    const session = loadSession();
    if (!session) return false;
    set({
      roomId: session.roomId,
      roomToken: session.roomToken,
      myRole: session.myRole,
      myNickname: session.myNickname,
      myCharacter: session.myCharacter,
    });
    return true;
  },

  reset: () => {
    wsClient.disconnect();
    clearSession();
    set(initialState);
  },
}));

// Helper: extract moves from game tree
function getMovesFromTree(): ({ x: number; y: number } | null)[] {
  const gs = useGameStore.getState();
  const moves: ({ x: number; y: number } | null)[] = [];
  let node = gs.gameTree;
  while (node.children.length > 0) {
    node = node.children[0];
    moves.push(
      node.x !== null && node.y !== null ? { x: node.x, y: node.y } : null,
    );
  }
  return moves;
}

// Helper: enter review mode with current game state and auto-analyze
function enterReviewMode(winner?: PlayerColor): void {
  setTimeout(() => {
    const gs = useGameStore.getState();
    const moves = getMovesFromTree();
    gs.loadMatch(
      [null, ...moves],
      undefined,
      gs.gameResultText || undefined,
      gs.boardSize,
      gs.handicap,
      winner,
    );
    // Auto-trigger win rate analysis
    startReviewAnalysis();
    // Fetch dead stones for the final position
    fetchAIScore(moves, gs.boardSize, gs.handicap)
      .then((data) => {
        if (data.deadStones) {
          useGameStore.getState().setDeadStones(data.deadStones);
        }
      })
      .catch(() => {});
  }, 1500);
}

// Helper: save match and enter review mode (for resign / opponent-left)
function autoSaveAndReview(
  myColor: PlayerColor | null,
  winner: PlayerColor | undefined,
): void {
  const gs = useGameStore.getState();
  const moves = getMovesFromTree();
  saveMatch({
    mode: "Online",
    aiDifficulty: null,
    humanColor: myColor,
    winner: winner ?? null,
    sgfData: JSON.stringify({
      moves: [null, ...moves],
      resultText: gs.gameResultText || undefined,
      resultWinner: winner,
      boardSize: gs.boardSize,
      handicap: gs.handicap,
    }),
  }).catch(() => {});

  enterReviewMode(winner);
}

// Handle incoming WebSocket messages
function handleWsMessage(
  msg: { type: string; payload?: Record<string, unknown> },
  _state: OnlineState,
  set: (partial: Partial<OnlineState>) => void,
): void {
  const gameStore = useGameStore.getState();

  switch (msg.type) {
    case "room_state": {
      const p = msg.payload!;
      if (p.chat) {
        set({ chatMessages: p.chat as ChatMessage[] });
      }
      // Sync undo flags from server on reconnect
      const currentState = useOnlineStore.getState();
      if (currentState.roomInfo) {
        const updatedInfo = { ...currentState.roomInfo };
        if (typeof p.undoHostUsed === "boolean")
          updatedInfo.undoHostUsed = p.undoHostUsed;
        if (typeof p.undoGuestUsed === "boolean")
          updatedInfo.undoGuestUsed = p.undoGuestUsed;
        set({ roomInfo: updatedInfo });
      }
      break;
    }

    case "game_start": {
      // Refresh room info
      const state = useOnlineStore.getState();
      if (state.roomId) {
        fetchRoomInfo(state.roomId, set);
      }
      break;
    }

    case "move": {
      const p = msg.payload!;
      const x = p.x as number;
      const y = p.y as number;
      const color = p.color as PlayerColor;

      // Determine if this is the opponent's move
      const state = useOnlineStore.getState();
      const myColor = getMyColor(state);
      if (color !== myColor) {
        // Opponent's move — apply to board and play sound
        gameStore.placeStone(x, y);
        const { soundEnabled, soundVolume } = gameStore;
        playStoneSound(soundEnabled, soundVolume);
      }
      break;
    }

    case "pass": {
      const p = msg.payload!;
      const color = p.color as PlayerColor;
      const state = useOnlineStore.getState();
      const myColor = getMyColor(state);
      if (color !== myColor) {
        gameStore.passTurn();
        // Notify that opponent passed (key-based for i18n in widget)
        set({ notification: "opponent_passed" });
        setTimeout(() => useOnlineStore.getState().setNotification(null), 3000);
      }
      break;
    }

    case "game_over": {
      const p = msg.payload!;
      gameStore.resignGame();

      const state = useOnlineStore.getState();
      const myColor = getMyColor(state);

      // Update room info
      if (state.roomInfo) {
        set({
          roomInfo: {
            ...state.roomInfo,
            status: "finished",
            winner: (p.winner as "BLACK" | "WHITE") || null,
          },
        });
      }

      if (p.reason === "resign") {
        const resignedBy = p.resignedBy as PlayerColor;
        const winner = p.winner as PlayerColor;
        gameStore.setWinner(winner);
        gameStore.setGameResultText(`${winner} wins (${resignedBy} resigned)`);

        // Sound + notification
        const { soundEnabled, soundVolume } = gameStore;
        const isWinner = myColor === winner;
        if (isWinner) playWinSound(soundEnabled, soundVolume);
        else playLoseSound(soundEnabled, soundVolume);
        set({ notification: isWinner ? "resign_win" : "resign_lose" });

        // Save + enter review mode
        autoSaveAndReview(myColor, winner);
      } else if (p.reason === "double_pass") {
        // Need AI scoring to determine winner
        set({ notification: "double_pass_review" });
        gameStore.setIsScoring(true);

        const moves = getMovesFromTree();
        fetchAIScore(moves, gameStore.boardSize, gameStore.handicap)
          .then((data) => {
            const gs = useGameStore.getState();
            const { soundEnabled, soundVolume } = gs;

            if (data.deadStones) {
              gs.setDeadStones(data.deadStones);
            }

            let winnerColor: PlayerColor | "DRAW" | null = null;
            if (data.score) {
              if (data.score === "0" || data.score === "D+0") {
                // Draw
                winnerColor = "DRAW";
                gs.setWinner("DRAW");
                gs.setGameResultText("Draw");
                playWinSound(soundEnabled, soundVolume);
                set({ notification: "draw" });
              } else {
                winnerColor = data.score.startsWith("B") ? "BLACK" : "WHITE";
                gs.setWinner(winnerColor);
                const diffMatch = data.score.match(/\+([0-9.]+)/);
                const diff = diffMatch ? diffMatch[1] : "";
                const winnerName = winnerColor === "BLACK" ? "Black" : "White";
                gs.setGameResultText(`${winnerName} +${diff}`);

                const isWinner = myColor === winnerColor;
                if (isWinner) playWinSound(soundEnabled, soundVolume);
                else playLoseSound(soundEnabled, soundVolume);
                set({ notification: isWinner ? "score_win" : "score_lose" });
              }
            } else {
              gs.setGameResultText("Cannot calculate result");
            }

            gs.setIsScoring(false);

            // Save match with determined winner
            const finalWinner = winnerColor === "DRAW" ? null : winnerColor;
            saveMatch({
              mode: "Online",
              aiDifficulty: null,
              humanColor: myColor,
              winner: finalWinner,
              sgfData: JSON.stringify({
                moves: [null, ...moves],
                resultText: gs.gameResultText || undefined,
                resultWinner: finalWinner,
                boardSize: gs.boardSize,
                handicap: gs.handicap,
              }),
            }).catch(() => {});

            // Enter review mode
            enterReviewMode(finalWinner as PlayerColor | undefined);
          })
          .catch(() => {
            gameStore.setIsScoring(false);
            gameStore.setGameResultText("Failed to calculate result");
            enterReviewMode(undefined);
          });
      }
      break;
    }

    case "chat": {
      const p = msg.payload!;
      const chatMsg: ChatMessage = {
        sender: p.sender as "host" | "guest",
        message: p.message as string,
        createdAt: p.createdAt as string,
      };
      set({
        chatMessages: [...useOnlineStore.getState().chatMessages, chatMsg],
      });
      break;
    }

    case "undo_request": {
      set({ pendingUndoRequest: "received" });
      break;
    }

    case "undo_accepted": {
      set({ pendingUndoRequest: null, notification: null });
      // Reload the game state with new moves
      const p = msg.payload!;
      const moves = p.moves as ({ x: number; y: number } | null)[];
      const undoUsedBy = p.undoUsedBy as "host" | "guest" | undefined;
      const state = useOnlineStore.getState();
      if (state.roomInfo) {
        gameStore.resetGame();
        // Replay moves
        for (const move of moves) {
          if (move === null) {
            gameStore.passTurn();
          } else {
            gameStore.placeStone(move.x, move.y);
          }
        }
        // Update roomInfo with moves and undo flags
        const updatedRoomInfo = { ...state.roomInfo, moves };
        if (undoUsedBy === "host") updatedRoomInfo.undoHostUsed = true;
        if (undoUsedBy === "guest") updatedRoomInfo.undoGuestUsed = true;
        set({ roomInfo: updatedRoomInfo });
      }
      break;
    }

    case "undo_rejected": {
      set({ pendingUndoRequest: null, notification: "undo_rejected" });
      setTimeout(() => useOnlineStore.getState().setNotification(null), 3000);
      break;
    }

    case "room_closed": {
      const p = msg.payload!;
      const closedBy = p.by as "host" | "guest";
      const onlineState = useOnlineStore.getState();
      const iSentLeave = closedBy === onlineState.myRole;

      if (iSentLeave) {
        // I clicked leave — widget already handles navigation, just clean up
        // (This is a redundant echo from server; widget does reset+navigate)
        break;
      }

      // Opponent left
      const isPlaying = !gameStore.isReviewMode && !gameStore.isGameOver;
      if (isPlaying) {
        // Game was in progress — opponent left = I win
        const myColor = getMyColor(onlineState);
        gameStore.resignGame();
        if (myColor) {
          gameStore.setWinner(myColor);
          gameStore.setGameResultText(`${myColor} wins (opponent left)`);
          const { soundEnabled, soundVolume } = gameStore;
          playWinSound(soundEnabled, soundVolume);
        }
        set({ notification: "opponent_left_win" });
        autoSaveAndReview(myColor, myColor as PlayerColor | undefined);
      } else {
        // Already in review mode — just notify
        set({ notification: "opponent_left" });
      }

      // Disconnect WS (no longer needed)
      onlineState.disconnectWs();
      break;
    }

    case "opponent_disconnected":
      // ignore temp disconnects for now
      break;

    case "opponent_reconnected":
      set({ notification: null });
      break;

    case "error": {
      console.error("Online WS error:", msg.payload?.message);
      break;
    }
  }
}

function getMyColor(state: OnlineState): PlayerColor | null {
  if (!state.roomInfo || !state.myRole) return null;
  if (state.myRole === "host") return state.roomInfo.hostColor as PlayerColor;
  return state.roomInfo.hostColor === "BLACK" ? "WHITE" : "BLACK";
}

async function fetchRoomInfo(
  roomId: string,
  set: (partial: Partial<OnlineState>) => void,
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/online/rooms/${roomId}`);
    if (!res.ok) return;
    const info = (await res.json()) as RoomInfo;
    set({ roomInfo: info });
  } catch {
    // Ignore fetch errors
  }
}

// Helper to get my color (exported for use in components)
export function getOnlineMyColor(): PlayerColor | null {
  const state = useOnlineStore.getState();
  return getMyColor(state);
}
