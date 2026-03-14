import React from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/entities/match/model/store";
import { playPassSound, playNewGameSound } from "@/shared/lib/sound";

interface SettingsPanelProps {
  onResetSaveStatus: () => void;
  onShowConfirm: (
    message: string,
    onConfirm: () => void,
    title?: string,
  ) => void;
}

const SettingsPanel = ({
  onResetSaveStatus,
  onShowConfirm,
}: SettingsPanelProps) => {
  const { t, i18n } = useTranslation();
  const {
    gameMode,
    aiDifficulty,
    humanPlayerColor,
    boardSize,
    handicap,
    boardScale,
    soundEnabled,
    soundVolume,
    isTeacherMode,
    teacherVisits,
    isGameOver,
    setGameConfig,
    resetGame,
    toggleTeacherMode,
    passTurn,
    resignGame,
  } = useGameStore();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setGameConfig({ language: lng as "ko" | "en" });
  };

  const handleResetGame = () => {
    playNewGameSound(soundEnabled, soundVolume);
    resetGame();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
      <h2 className="font-bold text-gray-700 flex items-center gap-2 mb-2">
        <span className="text-xl">⚙️</span> {t("settings").replace("⚙️ ", "")}
      </h2>

      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-600">{t("language")}</span>
        <select
          value={i18n.language}
          onChange={(e) => changeLanguage(e.target.value)}
          className="bg-gray-50 border border-gray-200 rounded p-1 text-xs"
        >
          <option value="ko">한국어 (KO)</option>
          <option value="en">English (EN)</option>
        </select>
      </div>

      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50">
        <span className="font-medium text-gray-600">{t("mode")}</span>
        <select
          value={gameMode}
          onChange={(e) => {
            setGameConfig({ gameMode: e.target.value as "PvP" | "PvAI" });
            handleResetGame();
          }}
          className="bg-gray-50 border border-gray-200 rounded p-1 text-xs"
        >
          <option value="PvP">{t("pvp")}</option>
          <option value="PvAI">{t("pvai")}</option>
        </select>
      </div>

      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50">
        <span className="font-medium text-gray-600">{t("boardSize")}</span>
        <select
          value={boardSize}
          onChange={(e) => {
            const newSize = Number(e.target.value);
            if (newSize <= 9 && handicap > 0) {
              setGameConfig({ boardSize: newSize, handicap: 0 });
            } else if (newSize > 9 && handicap > newSize - 9) {
              setGameConfig({
                boardSize: newSize,
                handicap: Math.min(9, newSize - 9),
              });
            } else {
              setGameConfig({ boardSize: newSize });
            }
            handleResetGame();
          }}
          className="bg-gray-50 border border-gray-200 rounded p-1 text-xs"
        >
          <option value="5">5x5</option>
          <option value="6">6x6</option>
          <option value="7">7x7</option>
          <option value="8">8x8</option>
          <option value="9">9x9</option>
          <option value="11">11x11</option>
          <option value="13">13x13</option>
          <option value="15">15x15</option>
          <option value="17">17x17</option>
          <option value="19">19x19</option>
        </select>
      </div>

      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50">
        <span className="font-medium text-gray-600">{t("handicap")}</span>
        <select
          value={handicap}
          onChange={(e) => {
            setGameConfig({ handicap: Number(e.target.value) });
            handleResetGame();
          }}
          className="bg-gray-50 border border-gray-200 rounded p-1 text-xs"
          disabled={boardSize <= 9}
        >
          <option value="0">0</option>
          {boardSize > 9 &&
            Array.from(
              { length: Math.min(9, boardSize - 9) - 1 },
              (_, i) => i + 2,
            ).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
        </select>
      </div>

      {gameMode === "PvAI" && (
        <div className="space-y-3 pt-1 border-t border-gray-50">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-600">{t("myStone")}</span>
            <select
              value={humanPlayerColor}
              onChange={(e) => {
                setGameConfig({
                  humanPlayerColor: e.target.value as "BLACK" | "WHITE",
                });
                handleResetGame();
              }}
              className="bg-gray-50 border border-gray-200 rounded p-1 text-xs"
            >
              <option value="BLACK">{t("blackFirst")}</option>
              <option value="WHITE">{t("whiteSecond")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-600">{t("aiDifficulty")}</span>
              <span className="font-bold text-blue-600">
                Lv. {aiDifficulty}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              value={aiDifficulty}
              onChange={(e) =>
                setGameConfig({ aiDifficulty: Number(e.target.value) })
              }
              className="w-full accent-blue-600 h-1"
            />
          </div>
        </div>
      )}

      <div className="space-y-1 pt-1 border-t border-gray-50">
        <div className="flex justify-between text-[10px]">
          <span className="text-gray-600">{t("boardZoom")}</span>
          <span className="font-bold text-blue-600">
            {Math.round(boardScale * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.1"
          value={boardScale}
          onChange={(e) =>
            setGameConfig({ boardScale: Number(e.target.value) })
          }
          className="w-full accent-blue-600 h-1"
        />
      </div>

      <div className="flex justify-between items-center py-1">
        <span className="text-sm font-medium text-gray-600">{t("sound")}</span>
        <button
          onClick={() => setGameConfig({ soundEnabled: !soundEnabled })}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${soundEnabled ? "bg-blue-600" : "bg-gray-300"}`}
          aria-label={t("sound")}
          aria-pressed={soundEnabled}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${soundEnabled ? "translate-x-5" : "translate-x-1"}`}
          />
        </button>
      </div>

      {soundEnabled && (
        <div className="space-y-1 pt-1 border-t border-gray-50 mt-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-600">
              {t("volume", { defaultValue: "Volume" })}
            </span>
            <span className="font-bold text-blue-600">
              {Math.round(soundVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={soundVolume}
            onChange={(e) =>
              setGameConfig({ soundVolume: parseFloat(e.target.value) })
            }
            className="w-full accent-blue-600 h-1"
            aria-label={t("volume", { defaultValue: "Volume" })}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50 mt-1">
        <span className="font-medium text-gray-600">{t("teacherMode")}</span>
        <button
          onClick={toggleTeacherMode}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isTeacherMode ? "bg-blue-600" : "bg-gray-300"}`}
          aria-label={t("teacherMode")}
          aria-pressed={isTeacherMode}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isTeacherMode ? "translate-x-5" : "translate-x-1"}`}
          />
        </button>
      </div>

      {isTeacherMode && (
        <div className="space-y-1 pt-1 border-t border-gray-50 mt-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-600">{t("teacherLevel")}</span>
            <span className="font-bold text-blue-600">{teacherVisits}</span>
          </div>
          <input
            type="range"
            min="100"
            max="1000"
            step="10"
            value={teacherVisits}
            onChange={(e) =>
              setGameConfig({ teacherVisits: Number(e.target.value) })
            }
            className="w-full accent-blue-600 h-1"
          />
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-gray-50">
        <button
          onClick={() => {
            handleResetGame();
            onResetSaveStatus();
          }}
          className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-[10px] border border-red-200 uppercase tracking-tighter"
        >
          {t("newGame")}
        </button>
        {!isGameOver && (
          <>
            <button
              onClick={() => {
                playPassSound(soundEnabled, soundVolume);
                passTurn();
              }}
              className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-[10px] border border-gray-300 uppercase tracking-tighter"
            >
              {t("pass")}
            </button>
            <button
              onClick={() => {
                onShowConfirm(t("askResign"), resignGame, t("doResign"));
              }}
              className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-[10px] border border-gray-300 uppercase tracking-tighter"
            >
              {t("resign")}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(SettingsPanel);
