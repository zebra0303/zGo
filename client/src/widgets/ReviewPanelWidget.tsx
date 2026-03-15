import React, { useEffect, useCallback, useRef } from "react";
import { useGameStore } from "@/entities/match/model/store";
import { useGamePath } from "@/entities/match/lib/useGamePath";
import {
  useBranchPoints,
  BranchPoint,
} from "@/entities/match/lib/useBranchPoints";
import { useTranslation } from "react-i18next";

// refactor: merged WinRateGraphWidget + ReviewControlWidget into one compact panel
const ReviewPanelWidget = () => {
  const { t } = useTranslation();
  const {
    currentNode,
    isReviewMode,
    setCurrentNode,
    isAnalyzing,
    analysisProgress,
    goToPreviousMove,
    goToNextMove,
    showDeadStones,
    toggleDeadStones,
    deadStones,
  } = useGameStore();
  const { fullPath, currentIndexInPath, totalMoves } = useGamePath();
  const branchPoints = useBranchPoints();

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

  const mainBranchWinRates: number[] = fullPath.map((node) => node.winRate);
  const hasWinRateData = mainBranchWinRates.length > 1;
  const currentWinRate = currentNode.winRate;
  const winRateBlack = currentWinRate;
  const winRateWhite = 100 - winRateBlack;
  const isFinalMove = currentNode.children.length === 0;
  const hasDeadStones = deadStones && deadStones.length > 0;

  return (
    <div className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm">
      {/* Win rate header + graph */}
      {hasWinRateData && (
        <>
          <div className="flex justify-between items-center mb-1.5">
            <h2 className="font-bold text-gray-700 dark:text-gray-200 text-xs flex items-center gap-1.5">
              📊 {t("winRate")}
              {isAnalyzing && analysisProgress && (
                <span className="text-[10px] font-normal text-blue-500 animate-pulse">
                  {t("analyzingProgress", {
                    current: analysisProgress.current,
                    total: analysisProgress.total,
                  })}
                </span>
              )}
            </h2>
            <div className="flex gap-3 text-[10px] font-bold">
              <span className="text-black flex items-center gap-1">
                <div className="w-2 h-2 bg-black rounded-full" /> {t("black")}{" "}
                {winRateBlack.toFixed(1)}%
              </span>
              <span className="text-gray-400 flex items-center gap-1">
                <div className="w-2 h-2 bg-white border border-gray-300 rounded-full" />{" "}
                {t("white")} {winRateWhite.toFixed(1)}%
              </span>
            </div>
          </div>

          <div
            className="w-full h-16 bg-gray-50 dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-700 relative overflow-hidden cursor-pointer focus:outline-none focus:ring-2 ring-accent mb-2"
            role="slider"
            aria-label={t("winRateTimeline", "승률 타임라인 그래프")}
            aria-valuemin={0}
            aria-valuemax={Math.max(1, fullPath.length - 1)}
            aria-valuenow={currentIndexInPath}
            tabIndex={0}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const moves = Math.max(1, fullPath.length - 1);
              const ratio = Math.max(0, Math.min(1, x / rect.width));
              const targetIndex = Math.round(ratio * moves);
              if (fullPath[targetIndex]) {
                setCurrentNode(fullPath[targetIndex].id);
              }
            }}
            onKeyDown={(e) => {
              let newIndex = currentIndexInPath;
              if (e.key === "ArrowLeft") {
                newIndex = Math.max(0, currentIndexInPath - 1);
              } else if (e.key === "ArrowRight") {
                newIndex = Math.min(
                  fullPath.length - 1,
                  currentIndexInPath + 1,
                );
              }
              if (newIndex !== currentIndexInPath && fullPath[newIndex]) {
                setCurrentNode(fullPath[newIndex].id);
              }
            }}
          >
            <svg
              width="100%"
              height="100%"
              preserveAspectRatio="none"
              viewBox={`0 0 ${Math.max(1, fullPath.length - 1)} 100`}
            >
              <line
                x1="0"
                y1="50"
                x2={Math.max(1, fullPath.length - 1)}
                y2="50"
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="4"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={`M 0,${100 - mainBranchWinRates[0]} L ${mainBranchWinRates
                  .map((rate, i) => `${i},${100 - rate}`)
                  .join(" L ")}`}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {isAnalyzing && analysisProgress && (
                <line
                  x1={analysisProgress.current}
                  y1="0"
                  x2={analysisProgress.current}
                  y2="100"
                  stroke="#3b82f6"
                  strokeWidth="1"
                  strokeDasharray="3"
                  strokeOpacity="0.5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <line
                x1={currentIndexInPath}
                y1="0"
                x2={currentIndexInPath}
                y2="100"
                stroke="#ef4444"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </>
      )}

      {/* Navigation: prev + slider + move counter + next + dead stones toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={goToPreviousMove}
          disabled={currentNode.moveIndex === 0}
          className="p-1.5 w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 rounded-lg border dark:border-gray-600 shadow-sm transition-colors text-gray-700 dark:text-gray-200 font-bold text-sm shrink-0"
          aria-label={t("prevMove", "이전 수")}
        >
          &lt;
        </button>

        <input
          id="review-move-slider"
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
          className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600 min-w-0"
          aria-label={t("reviewTimeline", "복기 타임라인")}
        />

        <div
          className="text-xs font-mono font-semibold text-gray-600 dark:text-gray-300 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 shrink-0"
          aria-live="polite"
          aria-atomic="true"
        >
          {currentIndexInPath}/{totalMoves}
        </div>

        <button
          onClick={() => goToNextMove()}
          disabled={currentNode.children.length === 0}
          className="p-1.5 w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 rounded-lg border dark:border-gray-600 shadow-sm transition-colors text-gray-700 dark:text-gray-200 font-bold text-sm shrink-0"
          aria-label={t("nextMove", "다음 수")}
        >
          &gt;
        </button>

        <button
          onClick={toggleDeadStones}
          disabled={!isFinalMove || !hasDeadStones}
          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border shadow-sm shrink-0 ${
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

      {/* Branch point chips */}
      {branchPoints.length > 0 && (
        <BranchPointChips
          branchPoints={branchPoints}
          currentNodeId={currentNode.id}
          onNavigate={setCurrentNode}
        />
      )}
    </div>
  );
};

/** Horizontally scrollable branch point chip list */
const BranchPointChips = React.memo(
  ({
    branchPoints,
    currentNodeId,
    onNavigate,
  }: {
    branchPoints: BranchPoint[];
    currentNodeId: string;
    onNavigate: (nodeId: string) => void;
  }) => {
    const { t } = useTranslation();
    const activeChipRef = useRef<HTMLButtonElement>(null);

    // Auto-scroll to the active chip when it changes
    useEffect(() => {
      activeChipRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }, [currentNodeId]);

    return (
      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
          <span className="text-[10px] text-gray-400 font-medium shrink-0">
            {t("branchPoints", "갈림길")}
          </span>
          {branchPoints.map((bp) => {
            const isActive = bp.nodeId === currentNodeId;
            const isOnBranch = bp.activeChildIndex > 0;
            return (
              <button
                key={bp.nodeId}
                ref={isActive ? activeChipRef : undefined}
                onClick={() => onNavigate(bp.nodeId)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border transition-colors shrink-0 cursor-pointer ${
                  isActive
                    ? "ring-2 ring-blue-400 bg-blue-50 border-blue-200"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
                aria-label={t("branchChipAriaLabel", {
                  move: bp.moveIndex,
                  letter: bp.activeChildLabel,
                  total: bp.variationCount,
                  defaultValue: `${bp.moveIndex}수, ${bp.variationCount}개 중 ${bp.activeChildLabel} 변화`,
                })}
              >
                <span className="text-gray-500">#{bp.moveIndex}</span>
                <span
                  className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                    isOnBranch
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {bp.activeChildLabel}
                </span>
                <span className="text-gray-400">/{bp.variationCount}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

BranchPointChips.displayName = "BranchPointChips";

export default React.memo(ReviewPanelWidget);
