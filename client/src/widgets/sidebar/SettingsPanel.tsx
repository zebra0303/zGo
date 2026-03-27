import React from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/entities/match/model/store";
import { navigateTo } from "@/shared/lib/router";
import { playNewGameSound } from "@/shared/lib/sound";
import GameControls from "@/shared/ui/GameControls";
import { useShallow } from "zustand/react/shallow";
import { Select, ToggleSwitch } from "@zebra/core/client";

interface SettingsPanelProps {
  onResetSaveStatus: () => void;
}

const SettingsPanel = ({ onResetSaveStatus }: SettingsPanelProps) => {
  const { t } = useTranslation();
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
    currentNode,
    setGameConfig,
    resetGame,
    toggleTeacherMode,
    showConfirm,
  } = useGameStore(
    useShallow((s) => ({
      gameMode: s.gameMode,
      aiDifficulty: s.aiDifficulty,
      humanPlayerColor: s.humanPlayerColor,
      boardSize: s.boardSize,
      handicap: s.handicap,
      boardScale: s.boardScale,
      soundEnabled: s.soundEnabled,
      soundVolume: s.soundVolume,
      isTeacherMode: s.isTeacherMode,
      teacherVisits: s.teacherVisits,
      currentNode: s.currentNode,
      setGameConfig: s.setGameConfig,
      resetGame: s.resetGame,
      toggleTeacherMode: s.toggleTeacherMode,
      showConfirm: s.showConfirm,
    })),
  );

  // Confirm before resetting if a game is in progress
  const handleResetGame = (
    beforeReset?: () => void,
    afterReset?: () => void,
  ) => {
    const doReset = () => {
      beforeReset?.();
      playNewGameSound(soundEnabled, soundVolume);
      resetGame();
      afterReset?.();
    };
    if (currentNode.moveIndex > 0) {
      showConfirm(t("askNewGame"), doReset, t("doNewGame"));
    } else {
      doReset();
    }
  };

  const labelClass = "font-medium text-gray-600 dark:text-gray-300";
  const dividerClass = "border-t border-gray-50 dark:border-gray-700";

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm space-y-3">
      <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2 mb-2">
        <span className="text-xl">⚙️</span> {t("settings").replace("⚙️ ", "")}
      </h2>

      <div
        className={`flex items-center justify-between text-sm pt-1 ${dividerClass}`}
      >
        <span className={labelClass}>{t("mode")}</span>
        <Select
          id="setting-mode"
          value={gameMode}
          onChange={(e) => {
            const val = e.target.value as "PvP" | "PvAI";
            handleResetGame(() => setGameConfig({ gameMode: val }));
          }}
          className="w-24 h-8"
        >
          <option value="PvP">{t("pvp")}</option>
          <option value="PvAI">{t("pvai")}</option>
        </Select>
      </div>

      <div
        className={`flex items-center justify-between text-sm pt-1 ${dividerClass}`}
      >
        <span className={labelClass}>{t("boardSize")}</span>
        <Select
          id="setting-board-size"
          value={boardSize}
          onChange={(e) => {
            const newSize = Number(e.target.value);
            handleResetGame(() => {
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
            });
          }}
          className="w-24 h-8"
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
        </Select>
      </div>

      <div
        className={`flex items-center justify-between text-sm pt-1 ${dividerClass}`}
      >
        <span className={labelClass}>{t("handicap")}</span>
        <Select
          id="setting-handicap"
          value={handicap}
          onChange={(e) => {
            const val = Number(e.target.value);
            handleResetGame(() => setGameConfig({ handicap: val }));
          }}
          className="w-24 h-8"
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
        </Select>
      </div>

      {gameMode === "PvAI" && (
        <div className={`space-y-3 pt-1 ${dividerClass}`}>
          <div className="flex items-center justify-between text-sm">
            <span className={labelClass}>{t("myStone")}</span>
            <Select
              id="setting-player-color"
              value={humanPlayerColor}
              onChange={(e) => {
                const val = e.target.value as "BLACK" | "WHITE";
                handleResetGame(() => setGameConfig({ humanPlayerColor: val }));
              }}
              className="w-24 h-8"
            >
              <option value="BLACK">{t("blackFirst")}</option>
              <option value="WHITE">{t("whiteSecond")}</option>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-600 dark:text-gray-400">
                {t("aiDifficulty")}
              </span>
              <span className="font-bold text-accent">Lv. {aiDifficulty}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={aiDifficulty}
              onChange={(e) =>
                setGameConfig({ aiDifficulty: Number(e.target.value) })
              }
              className="w-full accent-[var(--primary)] h-1"
            />
          </div>
        </div>
      )}

      <div className={`space-y-1 pt-1 ${dividerClass}`}>
        <div className="flex justify-between text-[10px]">
          <span className="text-gray-600 dark:text-gray-400">
            {t("boardZoom")}
          </span>
          <span className="font-bold text-accent">
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
          className="w-full accent-[var(--primary)] h-1"
        />
      </div>

      <div className="flex justify-between items-center py-1">
        <span className={`text-sm ${labelClass}`}>{t("sound")}</span>
        <ToggleSwitch
          checked={soundEnabled}
          onToggle={() => setGameConfig({ soundEnabled: !soundEnabled })}
          label={t("sound")}
          size="sm"
        />
      </div>

      {soundEnabled && (
        <div className={`space-y-1 pt-1 ${dividerClass} mt-1`}>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-600 dark:text-gray-400">
              {t("volume", { defaultValue: "Volume" })}
            </span>
            <span className="font-bold text-accent">
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
            className="w-full accent-[var(--primary)] h-1"
            aria-label={t("volume", { defaultValue: "Volume" })}
          />
        </div>
      )}

      <div
        className={`flex items-center justify-between text-sm pt-1 ${dividerClass} mt-1`}
      >
        <span className={labelClass}>{t("teacherMode")}</span>
        <ToggleSwitch
          checked={isTeacherMode}
          onToggle={toggleTeacherMode}
          label={t("teacherMode")}
          size="sm"
        />
      </div>

      {isTeacherMode && (
        <div className={`space-y-1 pt-1 ${dividerClass} mt-1`}>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-600 dark:text-gray-400">
              {t("teacherLevel")}
            </span>
            <span className="font-bold text-accent">{teacherVisits}</span>
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
            className="w-full accent-[var(--primary)] h-1"
          />
        </div>
      )}

      {/* Online Game button */}
      <div className={`pt-2 ${dividerClass}`}>
        <button
          onClick={() => navigateTo({ page: "online-create" })}
          className="w-full py-2.5 bg-accent bg-accent-hover text-accent-foreground font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5"
        >
          🌐 {t("online.startOnline")}
        </button>
      </div>

      <div className={`pt-2 ${dividerClass}`}>
        <GameControls layout="grid" onActionComplete={onResetSaveStatus} />
      </div>
    </div>
  );
};

export default React.memo(SettingsPanel);
