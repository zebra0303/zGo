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
  boardSize: number;
  handicap: number;

  // Game Status
  consecutivePasses: number;
  isGameOver: boolean;
  isReviewMode: boolean;
  boardScale: number;
  soundEnabled: boolean;
  soundVolume: number;
  teacherVisits: number;
  ignoredRecommendation: { x: number; y: number }[] | null;
  teacherCritique: string | null;
  deadStones: { x: number; y: number }[] | null;

  placeStone: (x: number, y: number) => void;
  passTurn: () => void;
  resignGame: () => void;
  toggleTeacherMode: () => void;
  setTeacherCritique: (c: string | null) => void;
  setDeadStones: (stones: { x: number; y: number }[] | null) => void;
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
        | "soundVolume"
        | "teacherVisits"
        | "language"
        | "boardSize"
        | "handicap"
      >
    >,
  ) => void;
  setIgnoredRecommendation: (coords: { x: number; y: number }[] | null) => void;
  resetGame: () => void;
}

const createEmptyBoard = (size: number = 19): BoardState => {
  return Array(size)
    .fill(null)
    .map(() => Array(size).fill(null));
};

const getHandicapStones = (boardSize: number, handicap: number) => {
  let coords: {x: number, y: number}[] = [];
  if (handicap > 1 && boardSize >= 9) {
    const min = boardSize >= 13 ? 3 : 2;
    const max = boardSize - 1 - min;
    const mid = Math.floor(boardSize / 2);

    const corners = [
      { x: max, y: min },
      { x: min, y: max },
      { x: max, y: max },
      { x: min, y: min },
    ];
    const sides = [
      { x: min, y: mid },
      { x: max, y: mid },
      { x: mid, y: min },
      { x: mid, y: max },
    ];
    const center = { x: mid, y: mid };

    if (handicap === 2) coords = [corners[0], corners[1]];
    else if (handicap === 3) coords = [corners[0], corners[1], corners[2]];
    else if (handicap === 4) coords = corners;
    else if (handicap === 5) coords = [...corners, center];
    else if (handicap === 6) coords = [...corners, sides[0], sides[1]];
    else if (handicap === 7) coords = [...corners, sides[0], sides[1], center];
    else if (handicap === 8) coords = [...corners, ...sides];
    else if (handicap >= 9) coords = [...corners, ...sides, center];
  }
  return coords;
};
const setupInitialBoard = (boardSize: number, handicap: number): BoardState => {
  const board = createEmptyBoard(boardSize);
  const stones = getHandicapStones(boardSize, handicap);
  stones.forEach(({ x, y }) => {
    if (board[y] && board[y][x] === null) {
      board[y][x] = "BLACK";
    }
  });
  return board;
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      board: createEmptyBoard(19),
      currentPlayer: "BLACK",
      isTeacherMode: false,
      history: [createEmptyBoard(19)],
      moveCoordinates: [null], // index 0 has no move
      winRates: [50],
      currentMoveIndex: 0,
      capturedByBlack: 0,
      capturedByWhite: 0,

      gameMode: "PvP",
      aiDifficulty: 5,
      humanPlayerColor: "BLACK",
      language: "ko",
      boardSize: 19,
      handicap: 0,

      consecutivePasses: 0,
      isGameOver: false,
      isReviewMode: false,
      boardScale: 1.0,
      soundEnabled: true,
      soundVolume: 0.6,
      teacherVisits: 330,
      ignoredRecommendation: null,
      teacherCritique: null,
      deadStones: null,

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
            draft.deadStones = null;
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
            draft.deadStones = null;
          })
        );
      },

      resignGame: () => set({ isGameOver: true, ignoredRecommendation: null, deadStones: null }),

      toggleTeacherMode: () =>
        set((state) => ({
          isTeacherMode: !state.isTeacherMode,
          ignoredRecommendation: null,
          teacherCritique: null,
        })),

      setTeacherCritique: (c: string | null) => set({ teacherCritique: c }),

      setDeadStones: (stones: { x: number; y: number }[] | null) => set({ deadStones: stones }),

      goToPreviousMove: () => {
        const { currentMoveIndex, history, handicap } = get();
        if (currentMoveIndex > 0) {
          const index = currentMoveIndex - 1;
          set({
            currentMoveIndex: index,
            board: history[index],
            currentPlayer: handicap > 0 
              ? (index % 2 === 0 ? "WHITE" : "BLACK") 
              : (index % 2 === 0 ? "BLACK" : "WHITE"),
            ignoredRecommendation: null,
            deadStones: null,
          });
        }
      },

      goToNextMove: () => {
        const { currentMoveIndex, history, handicap } = get();
        if (currentMoveIndex < history.length - 1) {
          const index = currentMoveIndex + 1;
          set({
            currentMoveIndex: index,
            board: history[index],
            currentPlayer: handicap > 0 
              ? (index % 2 === 0 ? "WHITE" : "BLACK") 
              : (index % 2 === 0 ? "BLACK" : "WHITE"),
            ignoredRecommendation: null,
            deadStones: null,
          });
        }
      },

      setMoveIndex: (index: number) => {
        const { history, handicap } = get();
        if (index >= 0 && index < history.length) {
          set({
            currentMoveIndex: index,
            board: history[index],
            currentPlayer: handicap > 0 
              ? (index % 2 === 0 ? "WHITE" : "BLACK") 
              : (index % 2 === 0 ? "BLACK" : "WHITE"),
            ignoredRecommendation: null,
            deadStones: null,
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
        const { boardSize, handicap } = get();
        let tempBoard = setupInitialBoard(boardSize || 19, handicap || 0);
        const newHistory = [tempBoard];
        const newMoveCoords: ({ x: number; y: number } | null)[] = [null];
        const newWinRates: number[] = [50];

        // Re-simulate all moves to populate history with BoardStates
        moves.slice(1).forEach((move, i) => {
          const color = handicap > 0 
            ? (i % 2 === 0 ? "WHITE" : "BLACK") 
            : (i % 2 === 0 ? "BLACK" : "WHITE");
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
          currentPlayer: handicap > 0 
            ? ((newHistory.length - 1) % 2 === 0 ? "WHITE" : "BLACK") 
            : ((newHistory.length - 1) % 2 === 0 ? "BLACK" : "WHITE"),
          isReviewMode: true,
          isGameOver: false,
          ignoredRecommendation: null,
          deadStones: null,
        });
      },

      setGameConfig: (config) => set((state) => {
        const newState = { ...state, ...config };
        // If board size is 9x9 or smaller, handicap must be 0
        if (newState.boardSize <= 9) {
          newState.handicap = 0;
        } else if (newState.handicap > Math.min(9, newState.boardSize - 9)) {
          newState.handicap = Math.min(9, newState.boardSize - 9);
        }
        return newState;
      }),

      setIgnoredRecommendation: (coords) =>
        set({ ignoredRecommendation: coords }),

      resetGame: () => {
        queryClient.removeQueries({ queryKey: ["aiHint"] });
        
        const { boardSize, handicap } = get();
        const newBoard = setupInitialBoard(boardSize, handicap);
        const startingPlayer: PlayerColor = handicap > 0 ? "WHITE" : "BLACK";

        set({
          board: newBoard,
          currentPlayer: startingPlayer,
          history: [newBoard],
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
          deadStones: null,
        });
      },
    }),
    {
      name: "zgo-game-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
