import { useGameStore } from "@/entities/match/model/store";
import { useEffect, useCallback } from "react";

const ReviewControlWidget = () => {
  const {
    isReviewMode,
    currentMoveIndex,
    history: gameHistory,
    goToPreviousMove,
    goToNextMove,
    winRates,
    setMoveIndex,
  } = useGameStore();

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

  const totalMoves = Math.max(1, gameHistory.length - 1);
  const currentAiWinRate =
    winRates && winRates[currentMoveIndex] !== undefined
      ? winRates[currentMoveIndex]
      : 50;
  const winRateBlack = currentAiWinRate;
  const winRateWhite = 100 - winRateBlack;

  return (
    <div className="w-full mt-4 bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl p-4 shadow-sm">
      <div className="flex justify-between text-xs font-bold mb-2">
        <span className="text-gray-800">흑 {winRateBlack.toFixed(1)}%</span>
        <span className="text-gray-500">백 {winRateWhite.toFixed(1)}%</span>
      </div>

      {winRates && winRates.length > 1 && (
        <div
          className="w-full h-12 bg-gray-100 rounded border border-gray-200 relative overflow-hidden mb-4 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = x / rect.width;
            const targetIndex = Math.round(ratio * totalMoves);
            setMoveIndex(Math.max(0, Math.min(targetIndex, totalMoves)));
          }}
        >
          <svg
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            viewBox={`0 0 ${winRates.length - 1} 100`}
          >
            <path
              d={`M 0,50 L ${winRates
                .map((rate, i) => `${i},${100 - rate}`)
                .join(" L ")}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="0"
              y1="50"
              x2={winRates.length - 1}
              y2="50"
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="4"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={currentMoveIndex}
              y1="0"
              x2={currentMoveIndex}
              y2="100"
              stroke="#ef4444"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <input
          type="range"
          min="0"
          max={totalMoves}
          value={currentMoveIndex}
          onChange={(e) => setMoveIndex(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />

        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousMove}
            disabled={currentMoveIndex === 0}
            className="p-2 w-12 h-10 flex items-center justify-center bg-white hover:bg-gray-50 disabled:opacity-30 rounded-lg border shadow-sm transition-colors text-gray-700 font-bold"
            title="이전 수 (왼쪽 화살표)"
          >
            &lt;
          </button>
          <div className="text-sm font-mono font-semibold text-gray-600 px-4 py-1.5 bg-gray-100 rounded-md border border-gray-200">
            {currentMoveIndex} / {totalMoves}
          </div>
          <button
            onClick={goToNextMove}
            disabled={currentMoveIndex === totalMoves}
            className="p-2 w-12 h-10 flex items-center justify-center bg-white hover:bg-gray-50 disabled:opacity-30 rounded-lg border shadow-sm transition-colors text-gray-700 font-bold"
            title="다음 수 (오른쪽 화살표)"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewControlWidget;
