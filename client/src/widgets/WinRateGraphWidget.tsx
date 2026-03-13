import { useGameStore } from "@/entities/match/model/store";
import { useTranslation } from "react-i18next";

const WinRateGraphWidget = () => {
  const { t } = useTranslation();
  const {
    winRates,
    currentMoveIndex,
    isReviewMode,
    setMoveIndex
  } = useGameStore();

  if (!isReviewMode || !winRates || winRates.length <= 1) return null;

  const currentWinRate = winRates[currentMoveIndex] ?? 50;
  const winRateBlack = currentWinRate;
  const winRateWhite = 100 - winRateBlack;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm w-full">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-bold text-gray-700 text-sm flex items-center gap-2">
          📊 {t('winRate')}
        </h2>
        <div className="flex gap-4 text-[10px] font-bold">
          <span className="text-black flex items-center gap-1">
            <div className="w-2 h-2 bg-black rounded-full" /> {t('black')} {winRateBlack.toFixed(1)}%
          </span>
          <span className="text-gray-400 flex items-center gap-1">
            <div className="w-2 h-2 bg-white border border-gray-300 rounded-full" /> {t('white')} {winRateWhite.toFixed(1)}%
          </span>
        </div>
      </div>

      <div
        className="w-full h-20 bg-gray-50 rounded border border-gray-100 relative overflow-hidden cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const totalMoves = Math.max(1, winRates.length - 1);
          const ratio = x / rect.width;
          const targetIndex = Math.round(ratio * totalMoves);
          setMoveIndex(Math.max(0, Math.min(targetIndex, totalMoves)));
        }}
      >
        <svg
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          viewBox={`0 0 ${Math.max(1, winRates.length - 1)} 100`}
        >
          {/* Middle line (50%) */}
          <line
            x1="0"
            y1="50"
            x2={Math.max(1, winRates.length - 1)}
            y2="50"
            stroke="#e5e7eb"
            strokeWidth="1"
            strokeDasharray="4"
            vectorEffect="non-scaling-stroke"
          />
          
          {/* Win rate path */}
          <path
            d={`M 0,50 L ${winRates
              .map((rate, i) => `${i},${100 - rate}`)
              .join(" L ")}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          
          {/* Current move indicator */}
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
    </div>
  );
};

export default WinRateGraphWidget;
