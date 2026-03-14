import React from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/entities/match/model/store";
import { playNewGameSound } from "@/shared/lib/sound";

interface GameStatusPanelProps {
  saveStatus: "idle" | "saving" | "saved" | "error";
  onSaveMatch: () => void;
}

const GameStatusPanel = ({ saveStatus, onSaveMatch }: GameStatusPanelProps) => {
  const { t } = useTranslation();
  const {
    currentPlayer,
    currentNode,
    isGameOver,
    isReviewMode,
    gameResultText,
    isScoring,
    deadStones,
    resetGame,
    soundEnabled,
    soundVolume,
  } = useGameStore();

  const capturedByBlack = currentNode.capturedByBlack;
  const capturedByWhite = currentNode.capturedByWhite;

  if (isReviewMode) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl shadow-sm flex flex-col gap-2 mb-4">
        <div className="font-bold flex items-center justify-between">
          <span>{t("reviewModeOn")}</span>
          <button
            onClick={() => {
              playNewGameSound(soundEnabled, soundVolume);
              resetGame();
            }}
            className="text-xs bg-amber-200 hover:bg-amber-300 px-2 py-1 rounded transition-colors"
          >
            {t("backToGame")}
          </button>
        </div>
        {currentNode.children.length === 0 &&
          currentNode.id !== "root" &&
          (gameResultText || isScoring) && (
            <div className="text-sm font-extrabold text-amber-900 bg-amber-100/50 rounded p-1.5 text-center">
              {isScoring
                ? t("resultScoring")
                : t("result", { text: gameResultText })}
            </div>
          )}
      </div>
    );
  }

  if (isGameOver) {
    return (
      <div className="bg-red-50 text-red-800 p-4 rounded-xl mb-4 shadow-inner text-center font-bold text-lg border border-red-200">
        <div className="mb-2">{t("gameOver")}</div>
        {gameResultText ? (
          <div className="text-xl text-red-600 mb-3 drop-shadow-sm font-extrabold">
            {gameResultText}
          </div>
        ) : isScoring ? (
          <div className="text-sm text-gray-500 mb-3">{t("scoring")}</div>
        ) : null}
        <div className="text-xs mb-3 flex justify-center gap-4 text-gray-600 font-medium">
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-black"></div>{" "}
            {t("capturedBlack", { count: capturedByBlack })}
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300"></div>{" "}
            {t("capturedWhite", { count: capturedByWhite })}
          </span>
        </div>
        {deadStones && deadStones.length > 0 && (
          <div className="text-[10px] text-red-500 font-bold mb-2 animate-pulse">
            ⚠️ {deadStones.length} dead stones identified on board
          </div>
        )}
        <button
          onClick={onSaveMatch}
          disabled={saveStatus !== "idle"}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition-colors text-sm disabled:opacity-50"
        >
          {saveStatus === "idle"
            ? t("saveRecord")
            : saveStatus === "saving"
              ? t("saving")
              : saveStatus === "saved"
                ? t("saved")
                : t("saveFailed")}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 p-4 rounded-xl mb-4 shadow-inner">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600 font-semibold">{t("currentTurn")}</span>
        <div className="flex items-center gap-2">
          <div
            className={`w-4 h-4 rounded-full shadow-sm border ${currentPlayer === "BLACK" ? "bg-black border-gray-800" : "bg-white border-gray-300"}`}
          ></div>
          <span className="font-bold text-lg">
            {currentPlayer === "BLACK" ? t("black") : t("white")}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between text-[10px] font-bold text-gray-500">
        <span>{t("capturedBlack", { count: capturedByBlack })}</span>
        <span>{t("capturedWhite", { count: capturedByWhite })}</span>
      </div>
    </div>
  );
};

export default React.memo(GameStatusPanel);
