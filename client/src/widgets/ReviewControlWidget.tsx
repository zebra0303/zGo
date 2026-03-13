import { useGameStore } from "@/entities/match/model/store";
import { useEffect, useCallback } from "react";

const ReviewControlWidget = () => {
  const {
    isReviewMode,
    currentMoveIndex,
    history: gameHistory,
    goToPreviousMove,
    goToNextMove,
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

  return (
    <div className="w-full bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl p-4 shadow-sm text-center">
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
