import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/entities/match/model/store";
import { useOnlineStore } from "@/entities/online/model/store";
import BoardCore from "@/features/board/ui/BoardCore";

const ReviewPanelWidget = lazy(() => import("@/widgets/ReviewPanelWidget"));

// Floating overlay above the board for online notifications + undo requests
const OnlineBoardOverlay = () => {
  const { t } = useTranslation();
  const notification = useOnlineStore((s) => s.notification);
  const pendingUndoRequest = useOnlineStore((s) => s.pendingUndoRequest);
  const respondUndo = useOnlineStore((s) => s.respondUndo);
  const isScoring = useGameStore((s) => s.isScoring);
  const gameResultText = useGameStore((s) => s.gameResultText);

  // Undo request received — show accept/reject
  if (pendingUndoRequest === "received") {
    return (
      <div className="animate-bounce-in mb-2 px-4 py-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-amber-300 dark:border-amber-600 rounded-xl shadow-lg">
        <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-2 text-center">
          🙏 {t("online.undoRequested")}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => respondUndo(true)}
            className="flex-1 py-1.5 bg-accent text-accent-foreground font-bold rounded-lg text-xs"
          >
            {t("confirm")}
          </button>
          <button
            onClick={() => respondUndo(false)}
            className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-lg text-xs"
          >
            {t("online.reject")}
          </button>
        </div>
      </div>
    );
  }

  // Undo request sent — waiting
  if (pendingUndoRequest === "sent") {
    return (
      <div className="animate-bounce-in mb-2 px-4 py-2.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-blue-300 dark:border-blue-600 rounded-xl shadow-lg flex items-center gap-2">
        <span className="text-xl">⏳</span>
        <span className="text-sm font-bold text-blue-600 dark:text-blue-300">
          {t("online.undoWaiting")}
        </span>
      </div>
    );
  }

  // Scoring in progress
  if (isScoring) {
    return (
      <div className="animate-bounce-in mb-2 px-4 py-2.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-accent/40 rounded-xl shadow-lg flex items-center gap-2">
        <span className="text-xl animate-spin">⏳</span>
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
          {t("scoring")}
        </span>
      </div>
    );
  }

  // Notification
  if (!notification) return null;

  // Map notification key → { text, icon }
  const notifMap: Record<string, { text: string; icon: string }> = {
    opponent_passed: { text: t("online.opponentPassed"), icon: "🧑‍🏫" },
    resign_win: { text: t("online.resignWin"), icon: "🎉" },
    resign_lose: { text: t("online.resignLose"), icon: "😔" },
    double_pass_review: { text: t("online.doublePassReview"), icon: "🔍" },
    undo_rejected: { text: t("online.undoRejected"), icon: "😔" },
    opponent_left_win: { text: t("online.opponentLeftWin"), icon: "🎉" },
    opponent_left: { text: t("online.opponentLeft"), icon: "👋" },
    score_win: {
      text: `${t("online.scoreWin")}${gameResultText ? ` (${gameResultText})` : ""}`,
      icon: "🎉",
    },
    score_lose: {
      text: `${t("online.scoreLose")}${gameResultText ? ` (${gameResultText})` : ""}`,
      icon: "😔",
    },
    draw: {
      text: `${t("draw")}${gameResultText ? ` (${gameResultText})` : ""}`,
      icon: "🤝",
    },
  };

  const entry = notifMap[notification] || { text: notification, icon: "🧑‍🏫" };

  return (
    <div className="animate-bounce-in mb-2 px-4 py-2.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-accent/40 rounded-xl shadow-lg flex items-center gap-2">
      <span className="text-xl">{entry.icon}</span>
      <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
        {entry.text}
      </span>
    </div>
  );
};

import { useAITurn } from "@/features/board/lib/useAITurn";
import { useGameScoring } from "@/features/board/lib/useGameScoring";

const BoardWidget = () => {
  const { isReviewMode, gameMode } = useGameStore();
  const isOnline = gameMode === "Online";

  // Mount AI and scoring logic here so they remain active even when sidebar is collapsed
  useAITurn();
  useGameScoring();

  return (
    <div className="flex flex-col items-center gap-4 px-2 md:px-4 py-4 md:py-6 max-w-full">
      {/* Top: Unified review panel (win rate graph + controls + branch chips) */}
      {isReviewMode && (
        <div className="w-full">
          <Suspense
            fallback={
              <div className="animate-pulse h-28 bg-gray-100 dark:bg-gray-800 rounded-xl" />
            }
          >
            <ReviewPanelWidget />
          </Suspense>
        </div>
      )}

      {/* Online overlay — notifications + undo requests above the board */}
      {isOnline && <OnlineBoardOverlay />}

      <div className="flex flex-col items-center w-fit max-w-full">
        {/* Middle: Board */}
        <div className="shadow-2xl rounded-sm overflow-hidden border-4 border-amber-900 dark:border-amber-800 bg-board-bg w-fit max-w-full relative mb-4">
          <BoardCore />
        </div>
      </div>
    </div>
  );
};

export default BoardWidget;
