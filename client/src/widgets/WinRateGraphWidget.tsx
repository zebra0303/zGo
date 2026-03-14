import { useGameStore, getPathToNode } from "@/entities/match/model/store";
import { useTranslation } from "react-i18next";

const WinRateGraphWidget = () => {
  const { t } = useTranslation();
  const {
    currentNode,
    isReviewMode,
    setCurrentNode,
    gameTree,
    isAnalyzing,
    analysisProgress,
  } = useGameStore();

  if (!isReviewMode) return null;

  // Get path from currentNode back to root
  const ancestorPath = getPathToNode(gameTree, currentNode.id) || [currentNode];

  // Get continuation path from currentNode down the main branch
  const continuationPath = [];
  let curr: any = currentNode.children[0];
  while (curr) {
    continuationPath.push(curr);
    curr = curr.children[0];
  }

  const fullPath = [...ancestorPath, ...continuationPath];
  const mainBranchWinRates: number[] = fullPath.map((node) => node.winRate);

  if (mainBranchWinRates.length <= 1) return null;

  const currentWinRate = currentNode.winRate;
  const winRateBlack = currentWinRate;
  const winRateWhite = 100 - winRateBlack;

  // Find the index of the current node in the full path
  const currentIndexInPath = ancestorPath.length - 1;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm w-full">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-bold text-gray-700 text-sm flex items-center gap-2">
          📊 {t('winRate')}
          {isAnalyzing && analysisProgress && (
            <span className="text-[10px] font-normal text-blue-500 animate-pulse">
              {t('analyzingProgress', { current: analysisProgress.current, total: analysisProgress.total })}
            </span>
          )}
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
          const totalMoves = Math.max(1, fullPath.length - 1);
          const ratio = Math.max(0, Math.min(1, x / rect.width));
          const targetIndex = Math.round(ratio * totalMoves);
          if (fullPath[targetIndex]) {
            setCurrentNode(fullPath[targetIndex].id);
          }
        }}
      >
        <svg
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          viewBox={`0 0 ${Math.max(1, fullPath.length - 1)} 100`}
        >
          {/* Middle line (50%) */}
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

          {/* Win rate path */}
          <path
            d={`M 0,${100 - mainBranchWinRates[0]} L ${mainBranchWinRates
              .map((rate, i) => `${i},${100 - rate}`)
              .join(" L ")}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {/* Analysis progress indicator */}
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

          {/* Current move indicator */}
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
    </div>
  );
};

export default WinRateGraphWidget;
