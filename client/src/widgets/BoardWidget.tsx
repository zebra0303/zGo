import { lazy, Suspense } from "react";
import { useGameStore } from "@/entities/match/model/store";
import BoardCore from "@/features/board/ui/BoardCore";

const ReviewControlWidget = lazy(() => import("@/widgets/ReviewControlWidget"));
const TeacherAdviceWidget = lazy(() => import("@/widgets/TeacherAdviceWidget"));
const WinRateGraphWidget = lazy(() => import("@/widgets/WinRateGraphWidget"));

const BoardWidget = () => {
  const { isReviewMode } = useGameStore();

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto px-4 py-6 relative">
      {/* Top: Win Rate Graph & Review Controls (if review mode) */}
      {isReviewMode && (
        <div className="w-full space-y-4">
          <Suspense
            fallback={
              <div className="animate-pulse h-20 bg-gray-100 rounded-xl" />
            }
          >
            <WinRateGraphWidget />
          </Suspense>
          <Suspense
            fallback={
              <div className="animate-pulse h-12 bg-gray-100 rounded-xl" />
            }
          >
            <ReviewControlWidget />
          </Suspense>
        </div>
      )}

      <div className="flex flex-col items-center w-fit">
        {/* Middle: Board */}
        <div className="shadow-2xl rounded-sm overflow-hidden border-4 border-amber-900 bg-board-bg w-fit relative mb-4">
          <BoardCore />
        </div>
      </div>

      <div className="absolute top-full left-0 w-full mt-2 z-10 px-4">
        {/* TeacherAdviceWidget handles its own isTeacherMode internal check, but we can also wrap it in Suspense */}
        <Suspense fallback={null}>
          <TeacherAdviceWidget />
        </Suspense>
      </div>
    </div>
  );
};

export default BoardWidget;
