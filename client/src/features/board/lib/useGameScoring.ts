import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useGameStore, getPathToNode } from "@/entities/match/model/store";
import { fetchAIScore } from "@/shared/api/gameApi";
import { playWinSound, playLoseSound } from "@/shared/lib/sound";
import { buildMoveHistory } from "@/shared/lib/goUtils";

/**
 * Hook that manages game-over scoring, dead stone detection, and win/lose sounds.
 * Extracted from SidebarWidget to reduce complexity (SRP).
 */
export const useGameScoring = () => {
  const { t } = useTranslation();
  // Select only required store slices with useShallow to avoid unrelated re-renders
  const {
    currentPlayer,
    currentNode,
    gameMode,
    humanPlayerColor,
    isGameOver,
    isReviewMode,
    soundEnabled,
    soundVolume,
    consecutivePasses,
    boardSize,
    handicap,
    setDeadStones,
    gameResultText,
    winner,
    setGameResultText,
    setWinner,
    setIsScoring,
    gameTree,
  } = useGameStore(
    useShallow((s) => ({
      currentPlayer: s.currentPlayer,
      currentNode: s.currentNode,
      gameMode: s.gameMode,
      humanPlayerColor: s.humanPlayerColor,
      isGameOver: s.isGameOver,
      isReviewMode: s.isReviewMode,
      soundEnabled: s.soundEnabled,
      soundVolume: s.soundVolume,
      consecutivePasses: s.consecutivePasses,
      boardSize: s.boardSize,
      handicap: s.handicap,
      setDeadStones: s.setDeadStones,
      gameResultText: s.gameResultText,
      winner: s.winner,
      setGameResultText: s.setGameResultText,
      setWinner: s.setWinner,
      setIsScoring: s.setIsScoring,
      gameTree: s.gameTree,
    })),
  );

  const playedGameOverSoundRef = useRef(false);
  const scoringNodeRef = useRef<string | null>(null);

  const getMoveHistory = useCallback(() => {
    const path = getPathToNode(gameTree, currentNode.id) || [currentNode];
    return buildMoveHistory(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode.id, gameTree]);

  // Game-over / end-of-branch scoring effect (offline modes only; online store owns online scoring)
  useEffect(() => {
    if (gameMode === "Online") return;
    const abortController = new AbortController();
    const isEndOfBranch =
      isReviewMode &&
      currentNode.children.length === 0 &&
      currentNode.id !== "root";

    if (isGameOver || isEndOfBranch) {
      if (scoringNodeRef.current === currentNode.id) return;
      scoringNodeRef.current = currentNode.id;

      const moveHistory = getMoveHistory();

      let isNaturalEnd = false;
      if (isGameOver && consecutivePasses >= 2) {
        isNaturalEnd = true;
      } else if (isEndOfBranch) {
        const lastMove = moveHistory[moveHistory.length - 1];
        const prevMove =
          moveHistory.length > 1
            ? moveHistory[moveHistory.length - 2]
            : undefined;
        if (lastMove === null && prevMove === null) {
          isNaturalEnd = true;
        }
      }

      if (!isNaturalEnd) {
        const loserColor = currentPlayer === "BLACK" ? "BLACK" : "WHITE";
        const winnerColor = currentPlayer === "BLACK" ? "WHITE" : "BLACK";
        const loserName = loserColor === "BLACK" ? t("black") : t("white");
        const winnerName = winnerColor === "BLACK" ? t("black") : t("white");

        setWinner(winnerColor);
        setGameResultText(
          t("resignWin", { loser: loserName, winner: winnerName }),
        );

        fetchAIScore(moveHistory, boardSize, handicap, abortController.signal)
          .then((data) => {
            if (data.deadStones) {
              setDeadStones(data.deadStones);
            }
          })
          .catch(() => {});
      } else {
        setIsScoring(true);
        fetchAIScore(moveHistory, boardSize, handicap, abortController.signal)
          .then((data) => {
            if (data.error === "NOT_FINISHED") {
              setGameResultText(
                t("calcError") +
                  ": " +
                  t("scoringNotReady", {
                    defaultValue: "대국이 아직 종료되지 않았습니다",
                  }),
              );
            } else if (data.score) {
              // Handle draw scores explicitly instead of mislabeling draws as White wins
              if (data.score === "0" || data.score === "D+0") {
                setWinner("DRAW");
                setGameResultText(t("draw"));
              } else {
                const winnerColor = data.score.startsWith("B")
                  ? "BLACK"
                  : "WHITE";
                const winnerName =
                  winnerColor === "BLACK" ? t("black") : t("white");

                setWinner(winnerColor);
                const diffMatch = data.score.match(/\+([0-9.]+)/);
                const diff = diffMatch ? diffMatch[1] : "";
                setGameResultText(
                  t("winByScore", { winner: winnerName, diff }),
                );
              }
            } else {
              setGameResultText(t("calcError"));
            }

            if (data.deadStones) {
              setDeadStones(data.deadStones);
            }
          })
          .catch((err) => {
            if (err?.name === "AbortError") return;
            console.error(err);
            setGameResultText(t("calcFail"));
          })
          .finally(() => setIsScoring(false));
      }
    } else {
      if (gameResultText !== null) setGameResultText(null);
      if (scoringNodeRef.current !== null) scoringNodeRef.current = null;
    }

    return () => abortController.abort();
  }, [
    gameMode,
    isGameOver,
    isReviewMode,
    currentNode.id,
    currentNode.children.length,
    consecutivePasses,
    currentPlayer,
    getMoveHistory,
    t,
    boardSize,
    handicap,
    setDeadStones,
    setGameResultText,
    setWinner,
    setIsScoring,
    gameResultText,
  ]);

  // Reset status when move node changes
  useEffect(() => {
    if (!isGameOver && !isReviewMode) {
      playedGameOverSoundRef.current = false;
    }
  }, [currentNode.id, isGameOver, isReviewMode]);

  // Handle Game Over Sounds (offline modes only; online store plays online result sounds)
  useEffect(() => {
    if (gameMode === "Online") return;
    if (
      isGameOver &&
      !isReviewMode &&
      !playedGameOverSoundRef.current &&
      winner
    ) {
      if (gameMode === "PvAI") {
        if (winner === humanPlayerColor) {
          playWinSound(soundEnabled, soundVolume);
        } else {
          playLoseSound(soundEnabled, soundVolume);
        }
      } else {
        playWinSound(soundEnabled, soundVolume);
      }
      playedGameOverSoundRef.current = true;
    }
  }, [
    isGameOver,
    isReviewMode,
    winner,
    gameMode,
    humanPlayerColor,
    soundEnabled,
    soundVolume,
  ]);

  return { getMoveHistory };
};
