import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { applyMove } from "@/entities/board/lib/goLogic";
import { queryClient } from "@/shared/api/queryClient";
import { produce } from "immer";
import { BoardState, PlayerColor } from "@/entities/board/model/types";
import { flattenTree, reconstructTree } from "@/shared/lib/treeUtils";

export interface HistoryNode {
  id: string;
  x: number | null; // null for pass or initial node
  y: number | null;
  color: PlayerColor | null;
  board: BoardState;
  capturedByBlack: number;
  capturedByWhite: number;
  winRate: number;
  children: HistoryNode[];
  parent: HistoryNode | null;
  moveIndex: number;
}

interface GameState {
  board: BoardState;
  currentPlayer: PlayerColor;
  isTeacherMode: boolean;
  
  // Tree-based History
  gameTree: HistoryNode;
  currentNode: HistoryNode;
  
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
  showDeadStones: boolean;
  boardScale: number;
  soundEnabled: boolean;
  soundVolume: number;
  teacherVisits: number;
  ignoredRecommendation: { x: number; y: number }[] | null;
  teacherCritique: string | null;
  deadStones: { x: number; y: number }[] | null;
  gameResultText: string | null;
  winner: PlayerColor | "DRAW" | null;
  isScoring: boolean;
  isAnalyzing: boolean;
  analysisProgress: { current: number; total: number } | null;

  placeStone: (x: number, y: number) => void;
  passTurn: () => void;
  resignGame: () => void;
  toggleTeacherMode: () => void;
  toggleDeadStones: () => void;
  setTeacherCritique: (c: string | null) => void;
  setDeadStones: (stones: { x: number; y: number }[] | null) => void;
  setGameResultText: (text: string | null) => void;
  setWinner: (winner: PlayerColor | "DRAW" | null) => void;
  setIsScoring: (isScoring: boolean) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setAnalysisProgress: (progress: { current: number; total: number } | null) => void;
  goToPreviousMove: () => void;
  goToNextMove: (variationIndex?: number) => void;
  setMoveIndex: (index: number) => void;
  setCurrentNode: (nodeId: string) => void;
  updateWinRate: (nodeId: string, winRate: number) => void;
  loadMatch: (
    moves: ({ x: number; y: number } | null)[],
    winRates?: number[],
    resultText?: string,
    savedBoardSize?: number,
    savedHandicap?: number,
    winner?: PlayerColor | "DRAW" | null,
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

const createInitialNode = (boardSize: number, handicap: number): HistoryNode => {
  const board = setupInitialBoard(boardSize, handicap);
  return {
    id: "root",
    x: null,
    y: null,
    color: null,
    board: board,
    capturedByBlack: 0,
    capturedByWhite: 0,
    winRate: 50,
    children: [],
    parent: null,
    moveIndex: 0,
  };
};

export const getNode = (root: HistoryNode, id: string): HistoryNode | null => {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = getNode(child, id);
    if (found) return found;
  }
  return null;
};

export const getPathToNode = (root: HistoryNode, id: string): HistoryNode[] | null => {
  if (root.id === id) return [root];
  for (const child of root.children) {
    const path = getPathToNode(child, id);
    if (path) return [root, ...path];
  }
  return null;
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      board: createEmptyBoard(19),
      currentPlayer: "BLACK",
      isTeacherMode: false,
      gameTree: createInitialNode(19, 0),
      currentNode: createInitialNode(19, 0),

      gameMode: "PvP",
      aiDifficulty: 5,
      humanPlayerColor: "BLACK",
      language: "ko",
      boardSize: 19,
      handicap: 0,

      consecutivePasses: 0,
      isGameOver: false,
      isReviewMode: false,
      showDeadStones: false,
      boardScale: 1.0,
      soundEnabled: true,
      soundVolume: 0.6,
      teacherVisits: 330,
      ignoredRecommendation: null,
      teacherCritique: null,
      deadStones: null,
      gameResultText: null,
      isScoring: false,
      isAnalyzing: false,
      analysisProgress: null,

      placeStone: (x: number, y: number) => {
        const {
          board,
          currentPlayer,
          currentNode,
          isGameOver,
          isReviewMode,
          gameMode,
          humanPlayerColor,
          ignoredRecommendation,
        } = get();

        if (isGameOver && !isReviewMode) return;

        const previousBoard = currentNode.parent ? currentNode.parent.board : null;

        const { newBoard, isValid, captured } = applyMove(
          board,
          x,
          y,
          currentPlayer,
          previousBoard,
        );

        if (!isValid) return;

        const nextIgnoredRecommendation =
          gameMode === "PvAI" && currentPlayer !== humanPlayerColor
            ? ignoredRecommendation
            : null;

        set(
          produce((draft) => {
            const currentInTree = getNode(draft.gameTree, draft.currentNode.id)!;
            const existingChild = currentInTree.children.find(
              (child: HistoryNode) => child.x === x && child.y === y
            );

            if (existingChild) {
              draft.currentNode = existingChild;
              draft.board = existingChild.board;
            } else {
              const newNode: HistoryNode = {
                id: Math.random().toString(36).substring(2, 9),
                x,
                y,
                color: currentPlayer,
                board: newBoard,
                capturedByBlack:
                  currentPlayer === "BLACK"
                    ? currentInTree.capturedByBlack + captured
                    : currentInTree.capturedByBlack,
                capturedByWhite:
                  currentPlayer === "WHITE"
                    ? currentInTree.capturedByWhite + captured
                    : currentInTree.capturedByWhite,
                winRate: currentInTree.winRate,
                children: [],
                parent: currentInTree,
                moveIndex: currentInTree.moveIndex + 1,
              };
              currentInTree.children.push(newNode);
              // Crucial fix: re-link draft.currentNode to the proxy object inside the tree
              draft.currentNode = currentInTree.children[currentInTree.children.length - 1];
              draft.board = newBoard;
            }

            draft.currentPlayer = currentPlayer === "BLACK" ? "WHITE" : "BLACK";
            draft.consecutivePasses = 0;
            draft.ignoredRecommendation = nextIgnoredRecommendation;
            draft.deadStones = null;
            draft.showDeadStones = false;
          })
        );
      },

      passTurn: () => {
        const {
          board,
          currentPlayer,
          consecutivePasses,
          isGameOver,
          isReviewMode,
          gameMode,
          humanPlayerColor,
          ignoredRecommendation,
        } = get();

        if (isGameOver && !isReviewMode) return;

        const nextIgnoredRecommendation =
          gameMode === "PvAI" && currentPlayer !== humanPlayerColor
            ? ignoredRecommendation
            : null;

        const newPasses = consecutivePasses + 1;
        const newGameOver = newPasses >= 2;

        set(
          produce((draft) => {
            const currentInTree = getNode(draft.gameTree, draft.currentNode.id)!;
            const existingChild = currentInTree.children.find(
              (child: HistoryNode) => child.x === null && child.y === null
            );

            if (existingChild) {
              draft.currentNode = existingChild;
            } else {
              const newNode: HistoryNode = {
                id: Math.random().toString(36).substring(2, 9),
                x: null,
                y: null,
                color: currentPlayer,
                board: board,
                capturedByBlack: currentInTree.capturedByBlack,
                capturedByWhite: currentInTree.capturedByWhite,
                winRate: currentInTree.winRate,
                children: [],
                parent: currentInTree,
                moveIndex: currentInTree.moveIndex + 1,
              };
              currentInTree.children.push(newNode);
              draft.currentNode = currentInTree.children[currentInTree.children.length - 1];
            }

            draft.currentPlayer = currentPlayer === "BLACK" ? "WHITE" : "BLACK";
            draft.consecutivePasses = newPasses;
            draft.isGameOver = newGameOver;
            draft.showDeadStones = newGameOver; // Auto-enable on game over
            draft.ignoredRecommendation = nextIgnoredRecommendation;
            draft.deadStones = null;
          })
        );
      },

      resignGame: () => set({ 
        isGameOver: true, 
        showDeadStones: true, // Auto-enable on resignation
        ignoredRecommendation: null, 
        deadStones: null 
      }),

      toggleTeacherMode: () =>
        set((state) => ({
          isTeacherMode: !state.isTeacherMode,
          ignoredRecommendation: null,
          teacherCritique: null,
        })),

      toggleDeadStones: () => set((state) => ({ showDeadStones: !state.showDeadStones })),

      setTeacherCritique: (c: string | null) => set({ teacherCritique: c }),

      setDeadStones: (stones: { x: number; y: number }[] | null) => set({ deadStones: stones }),

      setGameResultText: (text: string | null) => set({ gameResultText: text }),

      setWinner: (winner: PlayerColor | "DRAW" | null) => set({ winner }),

      setIsScoring: (isScoring: boolean) => set({ isScoring }),

      setIsAnalyzing: (isAnalyzing: boolean) => set({ isAnalyzing }),

      setAnalysisProgress: (progress: { current: number; total: number } | null) => set({ analysisProgress: progress }),

      goToPreviousMove: () => {
        const { gameTree, currentNode, handicap } = get();
        const path = getPathToNode(gameTree, currentNode.id);
        if (path && path.length > 1) {
          const prevNode = path[path.length - 2];
          set({
            currentNode: prevNode,
            board: prevNode.board,
            currentPlayer: handicap > 0 
              ? (prevNode.moveIndex % 2 === 0 ? "WHITE" : "BLACK") 
              : (prevNode.moveIndex % 2 === 0 ? "BLACK" : "WHITE"),
            ignoredRecommendation: null,
            deadStones: null,
            showDeadStones: false,
          });
        }
      },

      goToNextMove: (variationIndex = 0) => {
        const { currentNode, handicap } = get();
        if (currentNode.children.length > variationIndex) {
          const nextNode = currentNode.children[variationIndex];
          set({
            currentNode: nextNode,
            board: nextNode.board,
            currentPlayer: handicap > 0 
              ? (nextNode.moveIndex % 2 === 0 ? "WHITE" : "BLACK") 
              : (nextNode.moveIndex % 2 === 0 ? "BLACK" : "WHITE"),
            ignoredRecommendation: null,
            deadStones: null,
            showDeadStones: false,
          });
        }
      },

      setMoveIndex: (index: number) => {
        const { gameTree, handicap } = get();
        let targetNode = gameTree;
        for (let i = 0; i < index; i++) {
          if (targetNode.children.length > 0) {
            targetNode = targetNode.children[0];
          } else break;
        }
        
        set({
          currentNode: targetNode,
          board: targetNode.board,
          currentPlayer: handicap > 0 
            ? (targetNode.moveIndex % 2 === 0 ? "WHITE" : "BLACK") 
            : (targetNode.moveIndex % 2 === 0 ? "BLACK" : "WHITE"),
          ignoredRecommendation: null,
          deadStones: null,
          showDeadStones: false,
        });
      },

      setCurrentNode: (nodeId: string) => {
        const { gameTree, handicap } = get();
        let targetNode: HistoryNode | null = null;
        
        const findNode = (node: HistoryNode) => {
          if (node.id === nodeId) {
            targetNode = node;
            return true;
          }
          for (const child of node.children) {
            if (findNode(child)) return true;
          }
          return false;
        };
        findNode(gameTree);

        if (targetNode) {
          const tNode = targetNode as HistoryNode;
          set({
            currentNode: tNode,
            board: tNode.board,
            currentPlayer: handicap > 0 
              ? (tNode.moveIndex % 2 === 0 ? "WHITE" : "BLACK") 
              : (tNode.moveIndex % 2 === 0 ? "BLACK" : "WHITE"),
            ignoredRecommendation: null,
            deadStones: null,
            showDeadStones: false,
          });
        }
      },

      updateWinRate: (nodeId: string, winRate: number) => {
        set(
          produce((draft) => {
            const node = getNode(draft.gameTree, nodeId);
            if (node) {
              node.winRate = winRate;
            }
            // Re-link currentNode to prevent immer detachment
            draft.currentNode = getNode(draft.gameTree, draft.currentNode.id)!;
          })
        );
      },

      loadMatch: (
        moves: ({ x: number; y: number } | null)[],
        winRates?: number[],
        resultText?: string,
        savedBoardSize?: number,
        savedHandicap?: number,
        winner?: PlayerColor | "DRAW" | null,
      ) => {
        const boardSize = savedBoardSize || get().boardSize;
        const handicap = savedHandicap ?? get().handicap;
        const rootNode = createInitialNode(boardSize, handicap);
        let current = rootNode;

        moves.slice(1).forEach((move, i) => {
          const color = handicap > 0 
            ? (i % 2 === 0 ? "WHITE" : "BLACK") 
            : (i % 2 === 0 ? "BLACK" : "WHITE");
          const prevBoard = i > 0 ? current.board : null;

          let newBoard = current.board;
          let captured = 0;
          if (move) {
            const result = applyMove(current.board, move.x, move.y, color, prevBoard);
            newBoard = result.newBoard;
            captured = result.captured;
          }

          const newNode: HistoryNode = {
            id: Math.random().toString(36).substring(2, 9),
            x: move?.x ?? null,
            y: move?.y ?? null,
            color,
            board: newBoard,
            capturedByBlack: color === "BLACK" ? current.capturedByBlack + captured : current.capturedByBlack,
            capturedByWhite: color === "WHITE" ? current.capturedByWhite + captured : current.capturedByWhite,
            winRate: winRates && winRates[i+1] !== undefined ? winRates[i+1] : 50,
            children: [],
            parent: current,
            moveIndex: i + 1,
          };
          current.children.push(newNode);
          current = newNode;
        });

        set({
          gameTree: rootNode,
          currentNode: current,
          board: current.board,
          boardSize,
          handicap,
          currentPlayer: handicap > 0
            ? (current.moveIndex % 2 === 0 ? "WHITE" : "BLACK")
            : (current.moveIndex % 2 === 0 ? "BLACK" : "WHITE"),
          isReviewMode: true,
          isGameOver: false,
          ignoredRecommendation: null,
          deadStones: null,
          showDeadStones: true, // Auto-enable when entering review
          gameResultText: resultText || null, // Clear on load or set loaded text
          winner: winner || null,
          isScoring: false,
          isAnalyzing: false,
          analysisProgress: null,
        });
      },

      setGameConfig: (config) => set((state) => {
        const newState = { ...state, ...config };
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
        const rootNode = createInitialNode(boardSize, handicap);
        const startingPlayer: PlayerColor = handicap > 0 ? "WHITE" : "BLACK";

        set({
          gameTree: rootNode,
          currentNode: rootNode,
          board: rootNode.board,
          currentPlayer: startingPlayer,
          consecutivePasses: 0,
          isGameOver: false,
          isReviewMode: false,
          showDeadStones: false,
          ignoredRecommendation: null,
          teacherVisits: 330,
          deadStones: null,
          gameResultText: null,
          winner: null,
          isScoring: false,
          isAnalyzing: false,
          analysisProgress: null,
        });
      },
    }),
    {
      name: "zgo-game-storage",
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch (e) {
          // If localStorage is unavailable (e.g. in SSR or some test environments)
          // return a dummy storage to prevent warnings
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
      }),
      partialize: (state) => {
        const { gameTree, currentNode, ...rest } = state;
        // Exclude transient state like isAnalyzing
        delete (rest as any).isAnalyzing;
        delete (rest as any).analysisProgress;
        
        return {
          ...rest,
          flatTree: flattenTree(gameTree),
          currentNodeId: currentNode.id,
        } as any;
      },
      merge: (persistedState: any, currentState) => {
        if (!persistedState.flatTree) return currentState;
        const { root, current } = reconstructTree(persistedState.flatTree, persistedState.currentNodeId);
        return {
          ...currentState,
          ...persistedState,
          gameTree: root,
          currentNode: current,
          board: current.board,
        };
      },
    },
  ),
);
