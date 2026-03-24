import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CharacterType } from "@/entities/online/model/types";
import { useOnlineStore } from "@/entities/online/model/store";
import { navigateTo } from "@/shared/lib/router";
import { createMaskedError } from "@zebra/core";
import CharacterSelector from "./CharacterSelector";

const CreateRoomForm = () => {
  const { t } = useTranslation();
  const createRoom = useOnlineStore((s) => s.createRoom);

  const [nickname, setNickname] = useState("");
  const [character, setCharacter] = useState<CharacterType | null>(null);
  const [boardSize, setBoardSize] = useState(19);
  const [handicap, setHandicap] = useState(0);
  const [hostColor, setHostColor] = useState<"BLACK" | "WHITE">("BLACK");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError(
        t("online.nicknameRequired", {
          defaultValue: "Please enter a nickname.",
        }),
      );
      return;
    }
    if (!character) {
      setError(
        t("online.characterRequired", {
          defaultValue: "Please select a character.",
        }),
      );
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const roomId = await createRoom(
        nickname.trim(),
        character,
        boardSize,
        handicap,
        hostColor,
      );
      navigateTo({ page: "online-room", roomId });
    } catch (err) {
      const maskedErr = createMaskedError(err, "Failed to create room");
      setError(maskedErr.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ring-accent";
  const selectClass =
    "px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Nickname */}
      <div>
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
          {t("online.nickname", { defaultValue: "Nickname" })}
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t("online.nicknamePlaceholder", {
            defaultValue: "Enter your nickname",
          })}
          maxLength={12}
          className={inputClass}
          autoFocus
        />
      </div>

      {/* Character */}
      <div>
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
          {t("online.character", { defaultValue: "Character" })}
        </label>
        <CharacterSelector selected={character} onSelect={setCharacter} />
      </div>

      {/* Game Settings */}
      <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {t("boardSize")}
          </span>
          <select
            value={boardSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              setBoardSize(size);
              if (size <= 9) setHandicap(0);
            }}
            className={selectClass}
          >
            <option value="9">9x9</option>
            <option value="13">13x13</option>
            <option value="19">19x19</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {t("handicap")}
          </span>
          <select
            value={handicap}
            onChange={(e) => setHandicap(Number(e.target.value))}
            className={selectClass}
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

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {t("online.myColor", { defaultValue: "My Color" })}
          </span>
          <select
            value={hostColor}
            onChange={(e) => setHostColor(e.target.value as "BLACK" | "WHITE")}
            className={selectClass}
          >
            <option value="BLACK">{t("black")}</option>
            <option value="WHITE">{t("white")}</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      <div className="space-y-2 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-accent bg-accent-hover text-accent-foreground font-bold rounded-xl transition-all disabled:opacity-50 text-sm"
        >
          {isSubmitting
            ? "..."
            : t("online.createGame", { defaultValue: "Create Game" })}
        </button>

        <button
          type="button"
          onClick={() => navigateTo({ page: "main" })}
          disabled={isSubmitting}
          className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 font-bold rounded-xl transition-all disabled:opacity-50 text-xs"
        >
          {t("online.cancel", { defaultValue: "Cancel" })}
        </button>
      </div>
    </form>
  );
};

export default CreateRoomForm;
