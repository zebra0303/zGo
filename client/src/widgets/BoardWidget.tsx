import { lazy, Suspense, useState, useRef, useEffect } from "react";
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
import { restartEngine } from "@/shared/api/gameApi";
import { RefreshCcw } from "lucide-react";
import GameControls from "@/shared/ui/GameControls";
import { useShallow } from "zustand/react/shallow";

interface BoardWidgetProps {
  sidebarCollapsed?: boolean;
}

const BoardWidget = ({ sidebarCollapsed }: BoardWidgetProps) => {
  const { t } = useTranslation();
  const { isReviewMode, gameMode } = useGameStore(
    useShallow((s) => ({
      isReviewMode: s.isReviewMode,
      gameMode: s.gameMode,
    })),
  );
  const isOnline = gameMode === "Online";
  const [isRestarting, setIsRestarting] = useState(false);

  // refactor: track mount status to prevent state updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleRestartEngine = async () => {
    if (isRestarting) return;
    setIsRestarting(true);
    try {
      await restartEngine();
      useGameStore.getState().forceAITurn();
    } catch (e) {
      console.error("Failed to restart engine:", e);
    } finally {
      setTimeout(() => {
        if (isMounted.current) setIsRestarting(false);
      }, 1000);
    }
  };

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

        {/* KataGo Engine Restart Button - Below Board */}
        <div className="w-full flex flex-col gap-4">
          {sidebarCollapsed && !isOnline && (
            <div className="w-full animate-fade-in px-2">
              <GameControls layout="row" />
            </div>
          )}

          <div className="w-full flex justify-end px-2">
            <button
              onClick={handleRestartEngine}
              disabled={isRestarting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-sm transition-all text-xs font-medium
                ${isRestarting ? "opacity-70 cursor-not-allowed" : "hover:shadow-md active:scale-95"}
              `}
              title={t("admin.restartEngine", "KataGo 엔진 재실행")}
            >
              <RefreshCcw
                size={14}
                className={isRestarting ? "animate-spin text-accent" : ""}
              />
              <span>{t("admin.restartEngine", "KataGo 엔진 재실행")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardWidget;
