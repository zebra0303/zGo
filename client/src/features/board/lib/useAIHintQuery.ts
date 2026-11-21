import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { useGameStore, getPathToNode } from "@/entities/match/model/store";
import { fetchAIHint } from "@/shared/api/gameApi";
import { buildMoveHistory } from "@/shared/lib/goUtils";

/**
 * Shared TanStack Query hook for AI teacher hints so BoardCore and TeacherAdviceWidget
 * always share one queryKey and consistent response shape (including nodeId).
 */
export function useAIHintQuery() {
  const {
    board,
    currentPlayer,
    currentNode,
    isTeacherMode,
    isGameOver,
    isReviewMode,
    gameMode,
    humanPlayerColor,
    aiDifficulty,
    teacherVisits,
    language,
    boardSize,
    handicap,
    gameTree,
  } = useGameStore(
    useShallow((s) => ({
      board: s.board,
      currentPlayer: s.currentPlayer,
      currentNode: s.currentNode,
      isTeacherMode: s.isTeacherMode,
      isGameOver: s.isGameOver,
      isReviewMode: s.isReviewMode,
      gameMode: s.gameMode,
      humanPlayerColor: s.humanPlayerColor,
      aiDifficulty: s.aiDifficulty,
      teacherVisits: s.teacherVisits,
      language: s.language,
      boardSize: s.boardSize,
      handicap: s.handicap,
      gameTree: s.gameTree,
    })),
  );

  return useQuery({
    queryKey: [
      "aiHint",
      currentNode.id,
      currentPlayer,
      aiDifficulty,
      teacherVisits,
      language,
      boardSize,
      handicap,
    ],
    queryFn: async ({ signal }) => {
      const path = getPathToNode(gameTree, currentNode.id) || [currentNode];
      const moves = buildMoveHistory(path);

      const hint = await fetchAIHint(
        board,
        currentPlayer,
        aiDifficulty,
        teacherVisits,
        moves,
        signal,
        language,
        boardSize,
        handicap,
      );
      return { ...hint, nodeId: currentNode.id };
    },
    enabled:
      isTeacherMode &&
      !isGameOver &&
      (isReviewMode ||
        (gameMode !== "Online" &&
          (gameMode === "PvP" || currentPlayer === humanPlayerColor))),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
