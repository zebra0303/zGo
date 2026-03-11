import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { applyMove } from "@/entities/board/lib/goLogic";
import { queryClient } from "@/shared/api/queryClient";
import { produce } from "immer";
import { BoardState, PlayerColor } from "@/entities/board/model/types";

interface GameState {
  board: BoardState;
  currentPlayer: PlayerColor;
  isTeacherMode: boolean;
  history: BoardState[];
  moveCoordinates: ({ x: number; y: number } | null)[];
  winRates: number[];
  currentMoveIndex: number;
  capturedByBlack: number;
  capturedByWhite: number;

  // Game Settings
  gameMode: "PvP" | "PvAI";
  aiDifficulty: number;
  humanPlayerColor: PlayerColor;
  language: "ko" | "en";

  // Game Status
  consecutivePasses: number;
  isGameOver: boolean;
  isReviewMode: boolean;
  boardScale: number;
  soundEnabled: boolean;
  teacherVisits: number;
  ignoredRecommendation: { x: number; y: number }[] | null;

  placeStone: (x: number, y: number) => void;
  passTurn: () => void;
  resignGame: () => void;
  toggleTeacherMode: () => void;
  goToPreviousMove: () => void;
  goToNextMove: () => void;
  setMoveIndex: (index: number) => void;
  updateWinRate: (index: number, winRate: number) => void;
  loadMatch: (
    moves: ({ x: number; y: number } | null)[],
    winRates?: number[],
  ) => void;
  setGameConfig: (
    config: Partial<
      Pick<
        GameState,
        | "gameMode"
        | "aiDifficulty"
        | "humanPlayerColor"
        | "boardScale"
        | "soundEnabled"
        | "teacherVisits"
        | "language"
      >
    >,
  ) => void;
  setIgnoredRecommendation: (coords: { x: number; y: number }[] | null) => void;
  resetGame: () => void;
}

const createEmptyBoard = (): BoardState => {
  return Array(19)
    .fill(null)
    .map(() => Array(19).fill(null));
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      board: createEmptyBoard(),
      currentPlayer: "BLACK",
      isTeacherMode: false,
      history: [createEmptyBoard()],
      moveCoordinates: [null], // index 0 has no move
      winRates: [50],
      currentMoveIndex: 0,
      capturedByBlack: 0,
      capturedByWhite: 0,

      gameMode: "PvP",
      aiDifficulty: 5,
      humanPlayerColor: "BLACK",
      language: "ko",

      consecutivePasses: 0,
      isGameOver: false,
      isReviewMode: false,
      boardScale: 1.0,
      soundEnabled: true,
      teacherVisits: 330,
      ignoredRecommendation: null,

      placeStone: (x: number, y: number) => {
        const {
          board,
          currentPlayer,
          history,
          winRates,
          currentMoveIndex,
          isGameOver,
          isReviewMode,
          capturedByBlack,
          capturedByWhite,
          gameMode,
          humanPlayerColor,
          ignoredRecommendation,
        } = get();

        if (isGameOver || isReviewMode) return;

        const previousBoard =
          currentMoveIndex > 0 ? history[currentMoveIndex - 1] : null;

        // Apply move and calculate captures/liberties/ko
        const { newBoard, isValid, captured } = applyMove(
          board,
          x,
          y,
          currentPlayer,
          previousBoard,
        );

        if (!isValid) return; // Invalid move (e.g., suicide, occupied, ko)

        // AI 모드이고 현재가 AI의 차례라면 이전 흔적을 유지, 그 외(사용자 차례)에는 초기화
        const nextIgnoredRecommendation =
          gameMode === "PvAI" && currentPlayer !== humanPlayerColor
            ? ignoredRecommendation
            : null;

        set(
          produce((draft) => {
            draft.board = newBoard;
            draft.currentPlayer = currentPlayer === "BLACK" ? "WHITE" : "BLACK";
            draft.history = draft.history.slice(0, currentMoveIndex + 1);
            draft.history.push(newBoard);
            draft.moveCoordinates = draft.moveCoordinates.slice(
              0,
              currentMoveIndex + 1,
            );
            draft.moveCoordinates.push({ x, y });

            const newWinRates = winRates
              ? winRates.slice(0, currentMoveIndex + 1)
              : [50];
            newWinRates.push(newWinRates[newWinRates.length - 1]);
            draft.winRates = newWinRates;

            draft.currentMoveIndex = currentMoveIndex + 1;
            draft.consecutivePasses = 0;
            draft.capturedByBlack =
              currentPlayer === "BLACK"
                ? capturedByBlack + captured
                : capturedByBlack;
            draft.capturedByWhite =
              currentPlayer === "WHITE"
                ? capturedByWhite + captured
                : capturedByWhite;
            draft.ignoredRecommendation = nextIgnoredRecommendation;
          })
        );
      },

      passTurn: () => {
        const {
          board,
          currentPlayer,
          winRates,
          currentMoveIndex,
          consecutivePasses,
          isGameOver,
          isReviewMode,
          gameMode,
          humanPlayerColor,
          ignoredRecommendation,
        } = get();

        if (isGameOver || isReviewMode) return;

        // AI 모드이고 현재가 AI의 차례라면 이전 흔적을 유지, 그 외(사용자 차례)에는 초기화
        const nextIgnoredRecommendation =
          gameMode === "PvAI" && currentPlayer !== humanPlayerColor
            ? ignoredRecommendation
            : null;

        const newPasses = consecutivePasses + 1;
        const newGameOver = newPasses >= 2;

        set(
          produce((draft) => {
            draft.currentPlayer = currentPlayer === "BLACK" ? "WHITE" : "BLACK";
            draft.history = draft.history.slice(0, currentMoveIndex + 1);
            draft.history.push(board);
            draft.moveCoordinates = draft.moveCoordinates.slice(
              0,
              currentMoveIndex + 1,
            );
            draft.moveCoordinates.push(null);

            const newWinRates = winRates
              ? winRates.slice(0, currentMoveIndex + 1)
              : [50];
            newWinRates.push(newWinRates[newWinRates.length - 1]);
            draft.winRates = newWinRates;

            draft.currentMoveIndex = currentMoveIndex + 1;
            draft.consecutivePasses = newPasses;
            draft.isGameOver = newGameOver;
            draft.ignoredRecommendation = nextIgnoredRecommendation;
          })
        );
      },

      resignGame: () => set({ isGameOver: true, ignoredRecommendation: null }),

      toggleTeacherMode: () =>
        set((state) => ({
          isTeacherMode: !state.isTeacherMode,
          ignoredRecommendation: null,
        })),

      goToPreviousMove: () => {
        const { currentMoveIndex, history } = get();
        if (currentMoveIndex > 0) {
          set({
            currentMoveIndex: currentMoveIndex - 1,
            board: history[currentMoveIndex - 1],
            currentPlayer: (currentMoveIndex - 1) % 2 === 0 ? "BLACK" : "WHITE",
            ignoredRecommendation: null,
          });
        }
      },

      goToNextMove: () => {
        const { currentMoveIndex, history } = get();
        if (currentMoveIndex < history.length - 1) {
          set({
            currentMoveIndex: currentMoveIndex + 1,
            board: history[currentMoveIndex + 1],
            currentPlayer: (currentMoveIndex + 1) % 2 === 0 ? "BLACK" : "WHITE",
            ignoredRecommendation: null,
          });
        }
      },

      setMoveIndex: (index: number) => {
        const { history } = get();
        if (index >= 0 && index < history.length) {
          set({
            currentMoveIndex: index,
            board: history[index],
            currentPlayer: index % 2 === 0 ? "BLACK" : "WHITE",
            ignoredRecommendation: null,
          });
        }
      },

      updateWinRate: (index: number, winRate: number) => {
        const { winRates } = get();
        if (!winRates) return;
        const newWinRates = [...winRates];
        if (index < newWinRates.length) {
          newWinRates[index] = winRate;
          set({ winRates: newWinRates });
        }
      },

      loadMatch: (
        moves: ({ x: number; y: number } | null)[],
        winRates?: number[],
      ) => {
        let tempBoard = createEmptyBoard();
        const newHistory = [tempBoard];
        const newMoveCoords: ({ x: number; y: number } | null)[] = [null];
        const newWinRates: number[] = [50];

        // Re-simulate all moves to populate history with BoardStates
        moves.slice(1).forEach((move, i) => {
          const color = i % 2 === 0 ? "BLACK" : "WHITE";
          const prevBoard = i > 0 ? newHistory[newHistory.length - 1] : null;

          if (move) {
            const { newBoard } = applyMove(
              tempBoard,
              move.x,
              move.y,
              color,
              prevBoard,
            );
            tempBoard = newBoard;
          }
          newHistory.push(tempBoard);
          newMoveCoords.push(move);

          if (winRates && winRates[i + 1] !== undefined) {
            newWinRates.push(winRates[i + 1]);
          } else {
            newWinRates.push(newWinRates[newWinRates.length - 1]);
          }
        });

        set({
          board: tempBoard,
          history: newHistory,
          moveCoordinates: newMoveCoords,
          winRates: newWinRates,
          currentMoveIndex: newHistory.length - 1,
          currentPlayer: (newHistory.length - 1) % 2 === 0 ? "BLACK" : "WHITE",
          isReviewMode: true,
          isGameOver: false,
          ignoredRecommendation: null,
        });
      },

      setGameConfig: (config) => set((state) => ({ ...state, ...config })),

      setIgnoredRecommendation: (coords) =>
        set({ ignoredRecommendation: coords }),

      resetGame: () => {
        queryClient.removeQueries({ queryKey: ["aiHint"] });
        set({
          board: createEmptyBoard(),
          currentPlayer: "BLACK",
          history: [createEmptyBoard()],
          moveCoordinates: [null],
          winRates: [50],
          currentMoveIndex: 0,
          consecutivePasses: 0,
          isGameOver: false,
          isReviewMode: false,
          capturedByBlack: 0,
          capturedByWhite: 0,
          ignoredRecommendation: null,
          teacherVisits: 330,
        });
      },
    }),
    {
      name: "zgo-game-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
