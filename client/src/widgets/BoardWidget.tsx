import { useGameStore } from "@/entities/match/model/store";
import BoardCore from "@/features/board/ui/BoardCore";
import ReviewControlWidget from "@/widgets/ReviewControlWidget";
import TeacherAdviceWidget from "@/widgets/TeacherAdviceWidget";

const BoardWidget = () => {
  const { isReviewMode } = useGameStore();

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto px-4 py-6 relative">
      <div className="flex flex-col items-center w-fit">
        {/* Middle: Board */}
        <div className="shadow-2xl rounded-sm overflow-hidden border-4 border-amber-900 bg-board-bg w-fit relative mb-4">
          <BoardCore />
        </div>

        {/* Bottom: Review Controls (if review mode) */}
        {isReviewMode && (
          <div className="w-full mt-2">
            <ReviewControlWidget />
          </div>
        )}
      </div>

      <div className="absolute top-full left-0 w-full mt-2 z-10 px-4">
        <TeacherAdviceWidget />
      </div>
    </div>
  );
};

export default BoardWidget;
