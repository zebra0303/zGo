import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { applyMove } from "@/entities/board/lib/goLogic";
import { queryClient } from "@/shared/api/queryClient";
import { produce } from "immer";
import { PlayerColor } from "@/shared/types/board";
import { flattenTree, reconstructTree } from "@/entities/match/lib/treeUtils";
import { analyzeGame } from "@/shared/api/gameApi";
import { getPlayerForMove } from "@/shared/lib/goUtils";
import { HistoryNode, GameState } from "./types";
import {
  createEmptyBoard,
  createInitialNode,
  getNode,
  getPathToNode,
} from "../lib/boardUtils";

export { getPathToNode, getNode };

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
      theme:
        (typeof localStorage !== "undefined" &&
          (localStorage.getItem("theme") as "light" | "dark")) ||
        "light",
      primaryColor:
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("primary_color")) ||
        "#3b82f6",
      fontFamily:
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("font_family")) ||
        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
      reviewChat: null,
      gameResultText: null,
      winner: null,
      isScoring: false,
      isAnalyzing: false,
      analysisProgress: null,
      undoUsedInGame: false,
      aiForceTurnCounter: 0,

      // Global Dialog Implementation
      confirmDialog: {
        isOpen: false,
        type: "alert",
        message: "",
        onConfirm: () => {},
      },

      showConfirm: (message, onConfirm, title, type = "confirm") =>
        set((state) => ({
          confirmDialog: {
            isOpen: true,
            type,
            title,
            message,
            onConfirm: () => {
              onConfirm();
              state.closeConfirm();
            },
          },
        })),

      closeConfirm: () =>
        set((state) => ({
          confirmDialog: { ...state.confirmDialog, isOpen: false },
        })),

      forceAITurn: () =>
        set((state) => ({ aiForceTurnCounter: state.aiForceTurnCounter + 1 })),

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

        const previousBoard = currentNode.parent
          ? currentNode.parent.board
          : null;

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
            const currentInTree = getNode(
              draft.gameTree,
              draft.currentNode.id,
            )!;
            const existingChild = currentInTree.children.find(
              (child: HistoryNode) => child.x === x && child.y === y,
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
              draft.currentNode =
                currentInTree.children[currentInTree.children.length - 1];
              draft.board = newBoard;
            }

            draft.currentPlayer = currentPlayer === "BLACK" ? "WHITE" : "BLACK";
            draft.consecutivePasses = 0;
            draft.ignoredRecommendation = nextIgnoredRecommendation;
            draft.deadStones = null;
            draft.showDeadStones = false;
          }),
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
            const currentInTree = getNode(
              draft.gameTree,
              draft.currentNode.id,
            )!;
            const existingChild = currentInTree.children.find(
              (child: HistoryNode) => child.x === null && child.y === null,
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
              draft.currentNode =
                currentInTree.children[currentInTree.children.length - 1];
            }

            draft.currentPlayer = currentPlayer === "BLACK" ? "WHITE" : "BLACK";
            draft.consecutivePasses = newPasses;
            draft.isGameOver = newGameOver;
            draft.showDeadStones = newGameOver; // Auto-enable on game over
            draft.ignoredRecommendation = nextIgnoredRecommendation;
            draft.deadStones = null;
          }),
        );
      },

      resignGame: () =>
        set({
          isGameOver: true,
          showDeadStones: true, // Auto-enable on resignation
          ignoredRecommendation: null,
          deadStones: null,
        }),

      toggleTeacherMode: () =>
        set((state) => ({
          isTeacherMode: !state.isTeacherMode,
          ignoredRecommendation: null,
          teacherCritique: null,
        })),

      toggleDeadStones: () =>
        set((state) => ({ showDeadStones: !state.showDeadStones })),

      setTeacherCritique: (c: string | null) => set({ teacherCritique: c }),

      setDeadStones: (stones: { x: number; y: number }[] | null) =>
        set({ deadStones: stones }),

      setGameResultText: (text: string | null) => set({ gameResultText: text }),

      setWinner: (winner: PlayerColor | "DRAW" | null) => set({ winner }),

      setIsScoring: (isScoring: boolean) => set({ isScoring }),

      setIsAnalyzing: (isAnalyzing: boolean) => set({ isAnalyzing }),

      setAnalysisProgress: (
        progress: { current: number; total: number } | null,
      ) => set({ analysisProgress: progress }),

      // Undo last human move in PvAI (goes back 2 moves: AI response + human move)
      undoMove: () => {
        const { gameTree, currentNode, handicap, undoUsedInGame } = get();
        if (undoUsedInGame) return;
        const path = getPathToNode(gameTree, currentNode.id);
        if (!path || path.length < 3) return; // need at least root + human move + AI move
        const targetNode = path[path.length - 3]; // 2 moves back
        set({
          currentNode: targetNode,
          board: targetNode.board,
          currentPlayer: getPlayerForMove(targetNode.moveIndex, handicap),
          ignoredRecommendation: null,
          deadStones: null,
          showDeadStones: false,
          teacherCritique: null,
          consecutivePasses: 0,
          undoUsedInGame: true,
        });
      },

      goToPreviousMove: () => {
        const { gameTree, currentNode, handicap } = get();
        const path = getPathToNode(gameTree, currentNode.id);
        if (path && path.length > 1) {
          const prevNode = path[path.length - 2];
          set({
            currentNode: prevNode,
            board: prevNode.board,
            currentPlayer: getPlayerForMove(prevNode.moveIndex, handicap),
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
            currentPlayer: getPlayerForMove(nextNode.moveIndex, handicap),
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
          currentPlayer: getPlayerForMove(targetNode.moveIndex, handicap),
          ignoredRecommendation: null,
          deadStones: null,
          showDeadStones: false,
        });
      },

      // refactor: reuse shared getNode instead of inline findNode
      setCurrentNode: (nodeId: string) => {
        const { gameTree, handicap } = get();
        const targetNode = getNode(gameTree, nodeId);

        if (targetNode) {
          set({
            currentNode: targetNode,
            board: targetNode.board,
            currentPlayer: getPlayerForMove(targetNode.moveIndex, handicap),
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
          }),
        );
      },

      updateWinRates: (updates: { nodeId: string; winRate: number }[]) => {
        set(
          produce((draft) => {
            for (const { nodeId, winRate } of updates) {
              const node = getNode(draft.gameTree, nodeId);
              if (node) {
                node.winRate = winRate;
              }
            }
            // Re-link currentNode to prevent immer detachment
            draft.currentNode = getNode(draft.gameTree, draft.currentNode.id)!;
          }),
        );
      },

      loadMatch: (
        moves: ({ x: number; y: number } | null)[],
        winRates?: number[],
        resultText?: string,
        savedBoardSize?: number,
        savedHandicap?: number,
        winner?: PlayerColor | "DRAW" | null,
        reviewChat?: GameState["reviewChat"],
      ) => {
        const boardSize = savedBoardSize || get().boardSize;
        const handicap = savedHandicap ?? get().handicap;
        const rootNode = createInitialNode(boardSize, handicap);
        let current = rootNode;

        moves.slice(1).forEach((move, i) => {
          // refactor: i is 0-based forEach index; maps to getPlayerForMove(i, handicap)
          const color = getPlayerForMove(i, handicap);
          const prevBoard = i > 0 ? current.board : null;

          let newBoard = current.board;
          let captured = 0;
          if (move) {
            const result = applyMove(
              current.board,
              move.x,
              move.y,
              color,
              prevBoard,
            );
            newBoard = result.newBoard;
            captured = result.captured;
          }

          const newNode: HistoryNode = {
            id: Math.random().toString(36).substring(2, 9),
            x: move?.x ?? null,
            y: move?.y ?? null,
            color,
            board: newBoard,
            capturedByBlack:
              color === "BLACK"
                ? current.capturedByBlack + captured
                : current.capturedByBlack,
            capturedByWhite:
              color === "WHITE"
                ? current.capturedByWhite + captured
                : current.capturedByWhite,
            winRate:
              winRates && winRates[i + 1] !== undefined ? winRates[i + 1] : 50,
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
          currentPlayer: getPlayerForMove(current.moveIndex, handicap),
          isReviewMode: true,
          isGameOver: false,
          ignoredRecommendation: null,
          deadStones: null,
          reviewChat: reviewChat || null,
          showDeadStones: true, // Auto-enable when entering review
          gameResultText: resultText || null, // Clear on load or set loaded text
          winner: winner || null,
          isScoring: false,
          isAnalyzing: false,
          analysisProgress: null,
        });
      },

      setGameConfig: (config) =>
        set((state) => {
          const newState = { ...state, ...config };
          if (newState.aiDifficulty > 10) {
            newState.aiDifficulty = 10;
          }
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
          reviewChat: null,
          gameResultText: null,
          winner: null,
          isScoring: false,
          isAnalyzing: false,
          analysisProgress: null,
          undoUsedInGame: false,
          aiForceTurnCounter: 0,
        });
      },
    }),
    {
      name: "zgo-game-storage",
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch {
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
        // Exclude non-serializable tree refs and transient analysis state
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { gameTree, currentNode, ...rest } = state;
        const persistable = Object.fromEntries(
          Object.entries(rest).filter(
            ([k]) =>
              k !== "isAnalyzing" &&
              k !== "analysisProgress" &&
              k !== "reviewChat" &&
              k !== "confirmDialog",
          ),
        );

        return persistable;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      merge: (persistedState: any, currentState) => {
        let savedTreeData = null;
        try {
          if (typeof localStorage !== "undefined") {
            const raw = localStorage.getItem("zgo-game-tree");
            if (raw) savedTreeData = JSON.parse(raw);
          }
        } catch (e) {
          console.error("Failed to parse saved game tree", e);
        }

        if (!savedTreeData || !savedTreeData.flatTree)
          return { ...currentState, ...persistedState };

        const { root, current } = reconstructTree(
          savedTreeData.flatTree,
          savedTreeData.currentNodeId,
          persistedState.boardSize ?? currentState.boardSize,
          persistedState.handicap ?? currentState.handicap,
        );

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

// --- Manual throttled save for game tree to avoid blocking the main thread ---
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isSavePending = false;

const saveGameTree = () => {
  if (!isSavePending) return;
  const state = useGameStore.getState();
  try {
    const flatTree = flattenTree(state.gameTree);
    localStorage.setItem(
      "zgo-game-tree",
      JSON.stringify({ flatTree, currentNodeId: state.currentNode.id }),
    );
  } catch (e) {
    console.error("Failed to save game tree", e);
  }
  isSavePending = false;
};

// Listen to store changes and schedule a save
useGameStore.subscribe((state, prevState) => {
  if (
    state.gameTree !== prevState.gameTree ||
    state.currentNode.id !== prevState.currentNode.id
  ) {
    isSavePending = true;
    if (!saveTimeout) {
      saveTimeout = setTimeout(() => {
        saveGameTree();
        saveTimeout = null;
      }, 1000);
    }
  }
});

// Sync flush when page is hidden/unloaded to prevent data loss
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      saveGameTree();
    }
  });
}

// Module-level abort controller for analysis
let analysisAbort: AbortController | null = null;

/**
 * Start win rate analysis for the current game tree.
 * Callable from any store (e.g., online store after entering review mode).
 */
export function startReviewAnalysis(): void {
  const state = useGameStore.getState();
  const tree = state.gameTree;

  // Build moves array from main branch
  const moves: ({ x: number; y: number } | null)[] = [null];
  const nodeIds: string[] = [tree.id];
  let node = tree;
  while (node.children.length > 0) {
    node = node.children[0];
    nodeIds.push(node.id);
    moves.push(
      node.x !== null && node.y !== null ? { x: node.x, y: node.y } : null,
    );
  }

  if (moves.length <= 1) return;

  // Check if winRates already exist
  const winRates = nodeIds.map((id) => {
    const n = getNode(tree, id);
    return n ? n.winRate : 50;
  });
  if (winRates.some((r) => r !== 50)) return;

  // Abort previous analysis
  analysisAbort?.abort();
  const abortController = new AbortController();
  analysisAbort = abortController;

  const total = moves.length - 1;
  state.setIsAnalyzing(true);
  state.setAnalysisProgress({ current: 0, total });

  let pendingUpdates: { nodeId: string; winRate: number }[] = [];
  let rafId: number | null = null;
  let lastProcessedMoveIndex = 0;

  const flushUpdates = () => {
    const store = useGameStore.getState();
    if (pendingUpdates.length > 0) {
      store.updateWinRates(pendingUpdates);
      pendingUpdates = [];
    }
    store.setAnalysisProgress({ current: lastProcessedMoveIndex, total });
    rafId = null;
  };

  analyzeGame(
    moves,
    state.boardSize,
    state.handicap,
    (moveIndex, winRate) => {
      if (nodeIds[moveIndex]) {
        pendingUpdates.push({ nodeId: nodeIds[moveIndex], winRate });
      }
      lastProcessedMoveIndex = moveIndex;

      // Schedule UI update on next frame if not already scheduled
      if (!rafId) {
        rafId = requestAnimationFrame(flushUpdates);
      }
    },
    abortController.signal,
  )
    .then(() => {
      if (rafId) cancelAnimationFrame(rafId);
      const store = useGameStore.getState();
      if (pendingUpdates.length > 0) {
        store.updateWinRates(pendingUpdates);
      }
      store.setIsAnalyzing(false);
      store.setAnalysisProgress(null);
    })
    .catch((err) => {
      if (rafId) cancelAnimationFrame(rafId);
      if (err.name !== "AbortError") console.error("Analysis failed:", err);
      const store = useGameStore.getState();
      store.setIsAnalyzing(false);
      store.setAnalysisProgress(null);
    });
}
