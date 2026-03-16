import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore, getPathToNode } from "@/entities/match/model/store";
import { fetchAIMove } from "@/shared/api/gameApi";
import { playStoneSound } from "@/shared/lib/sound";
import { buildMoveHistory } from "@/shared/lib/goUtils";

/**
 * Hook that manages AI auto-play in PvAI mode.
 * Extracted from SidebarWidget to reduce complexity (SRP).
 *
 * Uses a ref-based closure pattern to prevent gameTree changes
 * (e.g., from updateWinRate) from aborting in-flight AI requests.
 */
export const useAITurn = () => {
  const { t } = useTranslation();
  const {
    board,
    currentPlayer,
    currentNode,
    gameMode,
    aiDifficulty,
    humanPlayerColor,
    placeStone,
    passTurn,
    resignGame,
    isGameOver,
    isReviewMode,
    soundEnabled,
    soundVolume,
    language,
    boardSize,
    handicap,
    updateWinRate,
    gameTree,
  } = useGameStore();

  const getMoveHistory = useCallback(() => {
    const path = getPathToNode(gameTree, currentNode.id) || [currentNode];
    return buildMoveHistory(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode.id, gameTree]);

  // Ref-based closure to avoid re-triggering effect when gameTree changes
  const stableRef = useRef({
    getMoveHistory,
    updateWinRate,
    currentNodeId: currentNode.id,
  });
  stableRef.current = {
    getMoveHistory,
    updateWinRate,
    currentNodeId: currentNode.id,
  };

  useEffect(() => {
    let isActive = true;
    const abortController = new AbortController();

    const playAITurn = async () => {
      if (
        isGameOver ||
        isReviewMode ||
        gameMode !== "PvAI" ||
        currentPlayer === humanPlayerColor
      )
        return;

      const moveHistory = stableRef.current.getMoveHistory();

      const MAX_RETRIES = 3;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await fetchAIMove(
            board,
            currentPlayer,
            aiDifficulty,
            moveHistory,
            abortController.signal,
            language,
            boardSize,
            handicap,
          );
          if (!isActive) return;

          if (response.winRate) {
            const blackWinRate =
              currentPlayer === "BLACK"
                ? response.winRate
                : 100 - response.winRate;
            stableRef.current.updateWinRate(
              stableRef.current.currentNodeId,
              blackWinRate,
            );
          }

          if (response.pass) {
            passTurn();
          } else if (response.resign) {
            resignGame();
          } else if (response.move) {
            placeStone(response.move.x, response.move.y);
            playStoneSound(soundEnabled, soundVolume);
          }
          return;
        } catch (err) {
          const error = err as Error;
          if (
            error?.name === "AbortError" ||
            error?.message?.includes("abort")
          ) {
            return;
          }
          if (attempt < MAX_RETRIES) {
            console.warn(
              `AI Move attempt ${attempt + 1} failed, retrying in ${3 + attempt * 2}s...`,
            );
            await new Promise((r) => setTimeout(r, (3 + attempt * 2) * 1000));
            if (!isActive) return;
          } else {
            console.error("AI Move Error after retries:", error);
          }
        }
      }
    };

    if (
      !isGameOver &&
      !isReviewMode &&
      gameMode === "PvAI" &&
      currentPlayer !== humanPlayerColor
    ) {
      const timer = setTimeout(() => playAITurn(), 600);
      return () => {
        isActive = false;
        clearTimeout(timer);
        abortController.abort();
      };
    }
    return () => {
      isActive = false;
      abortController.abort();
    };
    // Intentionally excludes getMoveHistory, updateWinRate, currentNode.id
    // to prevent gameTree changes from aborting in-flight AI requests.
  }, [
    gameMode,
    currentPlayer,
    humanPlayerColor,
    board,
    isGameOver,
    isReviewMode,
    placeStone,
    passTurn,
    resignGame,
    soundEnabled,
    soundVolume,
    aiDifficulty,
    t,
    language,
    boardSize,
    handicap,
  ]);

  return { getMoveHistory };
};
