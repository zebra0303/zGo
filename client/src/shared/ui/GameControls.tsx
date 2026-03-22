import { useTranslation } from "react-i18next";
import { useGameStore } from "@/entities/match/model/store";
import { playPassSound, playNewGameSound } from "@/shared/lib/sound";
import { useShallow } from "zustand/react/shallow";

interface GameControlsProps {
  layout?: "grid" | "row";
  className?: string;
  onActionComplete?: () => void;
}

const GameControls = ({
  layout = "grid",
  className = "",
  onActionComplete,
}: GameControlsProps) => {
  const { t } = useTranslation();
  const {
    gameMode,
    soundEnabled,
    soundVolume,
    isGameOver,
    isReviewMode,
    undoUsedInGame,
    currentNode,
    resetGame,
    passTurn,
    resignGame,
    undoMove,
    showConfirm,
  } = useGameStore(
    useShallow((s) => ({
      gameMode: s.gameMode,
      soundEnabled: s.soundEnabled,
      soundVolume: s.soundVolume,
      isGameOver: s.isGameOver,
      isReviewMode: s.isReviewMode,
      undoUsedInGame: s.undoUsedInGame,
      currentNode: s.currentNode,
      resetGame: s.resetGame,
      passTurn: s.passTurn,
      resignGame: s.resignGame,
      undoMove: s.undoMove,
      showConfirm: s.showConfirm,
    })),
  );

  const handleResetGame = () => {
    const doReset = () => {
      playNewGameSound(soundEnabled, soundVolume);
      resetGame();
      onActionComplete?.();
    };
    if (currentNode.moveIndex > 0) {
      showConfirm(t("askNewGame"), doReset, t("doNewGame"));
    } else {
      doReset();
    }
  };

  const handlePass = () => {
    playPassSound(soundEnabled, soundVolume);
    passTurn();
    onActionComplete?.();
  };

  const handleResign = () => {
    showConfirm(t("askResign"), resignGame, t("doResign"));
    onActionComplete?.();
  };

  const handleUndo = () => {
    showConfirm(t("askUndo"), undoMove, t("doUndo"));
    onActionComplete?.();
  };

  const baseBtnClass =
    "py-1.5 font-bold rounded-lg text-[10px] border uppercase tracking-tighter transition-all active:scale-95 flex items-center justify-center gap-1 whitespace-nowrap";
  const redBtnClass = `${baseBtnClass} bg-red-50 dark:bg-rose-900/20 hover:bg-red-100 dark:hover:bg-rose-900/40 text-red-600 dark:text-rose-400 border-red-200 dark:border-rose-800/50`;
  const grayBtnClass = `${baseBtnClass} bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600`;
  const amberBtnClass = `${baseBtnClass} bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700`;
  const disabledBtnClass = `${baseBtnClass} bg-gray-100 dark:bg-gray-800/40 text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-700/50 cursor-not-allowed opacity-50`;

  const containerClass =
    layout === "grid"
      ? `grid grid-cols-2 gap-2 ${className}`
      : `flex flex-wrap items-center justify-center gap-1.5 ${className}`;

  const getBtnClass = (baseClass: string, isDisabled = false) => {
    const finalBase = isDisabled ? disabledBtnClass : baseClass;
    return layout === "row" ? `${finalBase} px-2.5` : finalBase;
  };

  return (
    <div className={containerClass}>
      <button
        onClick={handleResetGame}
        className={getBtnClass(redBtnClass)}
        title={t("newGame")}
      >
        <span>🔄</span> {t("newGame")}
      </button>

      {!isGameOver && !isReviewMode && (
        <>
          <button
            onClick={handlePass}
            className={getBtnClass(grayBtnClass)}
            title={t("pass")}
          >
            <span>⏭️</span> {t("pass")}
          </button>

          <button
            onClick={handleResign}
            disabled={currentNode.moveIndex < 1}
            className={getBtnClass(grayBtnClass, currentNode.moveIndex < 1)}
            title={t("resign")}
          >
            <span>🏳️</span> {t("resign")}
          </button>

          {gameMode === "PvAI" && (
            <button
              onClick={handleUndo}
              disabled={undoUsedInGame || currentNode.moveIndex < 2}
              className={getBtnClass(
                amberBtnClass,
                undoUsedInGame || currentNode.moveIndex < 2,
              )}
              title={t("undo")}
            >
              <span>⏪</span> {t("undo")}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default GameControls;
