import { lazy, Suspense } from "react";
import { useGameStore } from "@/entities/match/model/store";
import BoardCore from "@/features/board/ui/BoardCore";

const ReviewPanelWidget = lazy(() => import("@/widgets/ReviewPanelWidget"));

const BoardWidget = () => {
  const { isReviewMode } = useGameStore();

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6">
      {/* Top: Unified review panel (win rate graph + controls + branch chips) */}
      {isReviewMode && (
        <div className="w-full">
          <Suspense
            fallback={
              <div className="animate-pulse h-28 bg-gray-100 rounded-xl" />
            }
          >
            <ReviewPanelWidget />
          </Suspense>
        </div>
      )}

      <div className="flex flex-col items-center w-fit">
        {/* Middle: Board */}
        <div className="shadow-2xl rounded-sm overflow-hidden border-4 border-amber-900 bg-board-bg w-fit relative mb-4">
          <BoardCore />
        </div>
      </div>
    </div>
  );
};

export default BoardWidget;
