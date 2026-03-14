import React, { useEffect, useCallback } from "react";
import { useGameStore } from "@/entities/match/model/store";
import { useGamePath } from "@/entities/match/lib/useGamePath";
import { useTranslation } from "react-i18next";

const ReviewControlWidget = () => {
  const { t } = useTranslation();
  const {
    isReviewMode,
    currentNode,
    goToPreviousMove,
    goToNextMove,
    setCurrentNode,
    showDeadStones,
    toggleDeadStones,
    deadStones,
  } = useGameStore();
  const { fullPath, currentIndexInPath, totalMoves } = useGamePath();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isReviewMode) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPreviousMove();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNextMove();
      }
    },
    [isReviewMode, goToPreviousMove, goToNextMove],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  if (!isReviewMode) return null;

  const isFinalMove = currentNode.children.length === 0;
  const hasDeadStones = deadStones && deadStones.length > 0;

  return (
    <div className="w-full bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl p-4 shadow-sm text-center">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max={totalMoves}
            value={currentIndexInPath}
            onChange={(e) => {
              const targetIndex = Number(e.target.value);
              if (fullPath[targetIndex]) {
                setCurrentNode(fullPath[targetIndex].id);
              }
            }}
            className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            aria-label={t("reviewTimeline", "복기 타임라인")}
          />

          {/* 스마트 사석 보기 토글 */}
          <button
            onClick={toggleDeadStones}
            disabled={!isFinalMove || !hasDeadStones}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${
              showDeadStones
                ? "bg-red-500 text-white border-red-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            } disabled:opacity-30 disabled:grayscale`}
            title={t(
              "toggleDeadStonesTitle",
              "최종 수에서만 사석을 볼 수 있습니다",
            )}
            aria-pressed={showDeadStones}
            aria-label={t("showDeadStones", "사석 보기")}
          >
            {t("showDeadStones", "사석 보기")}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousMove}
            disabled={currentNode.moveIndex === 0}
            className="p-2 w-12 h-10 flex items-center justify-center bg-white hover:bg-gray-50 disabled:opacity-30 rounded-lg border shadow-sm transition-colors text-gray-700 font-bold"
            title="이전 수 (왼쪽 화살표)"
            aria-label="이전 수"
          >
            &lt;
          </button>

          <div className="flex flex-col items-center">
            <div
              className="text-sm font-mono font-semibold text-gray-600 px-4 py-1.5 bg-gray-100 rounded-md border border-gray-200"
              aria-live="polite"
              aria-atomic="true"
            >
              {currentIndexInPath} / {totalMoves}
            </div>
            {currentNode.children.length > 1 && (
              <div
                className="text-[10px] text-blue-500 font-bold mt-1"
                aria-live="polite"
              >
                {currentNode.children.length} {t("variations", "갈림길")}
              </div>
            )}
          </div>

          <button
            onClick={() => goToNextMove()}
            disabled={currentNode.children.length === 0}
            className="p-2 w-12 h-10 flex items-center justify-center bg-white hover:bg-gray-50 disabled:opacity-30 rounded-lg border shadow-sm transition-colors text-gray-700 font-bold"
            title="다음 수 (오른쪽 화살표)"
            aria-label="다음 수"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ReviewControlWidget);
