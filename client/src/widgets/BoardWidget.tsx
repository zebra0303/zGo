import { useGameStore } from "@/entities/match/model/store";
import BoardCore from "@/features/board/ui/BoardCore";
import ReviewControlWidget from "@/widgets/ReviewControlWidget";

const BoardWidget = () => {
  const { isTeacherMode, isReviewMode } = useGameStore();

  return (
    <div className="flex flex-col items-center gap-4">
      {isTeacherMode && (
        <div className="text-blue-600 font-semibold animate-pulse flex items-center gap-1">
          <img
            src="/igo_logo.png"
            alt="iGo"
            className="w-5 h-5 object-contain"
          />
          AI 선생님 모드 활성화 중...
        </div>
      )}
      <div className="shadow-2xl rounded-sm overflow-hidden border-4 border-amber-900 bg-board-bg">
        <BoardCore />
      </div>
      {isReviewMode && (
        <div className="w-full mt-2">
          <ReviewControlWidget />
        </div>
      )}
    </div>
  );
};

export default BoardWidget;
