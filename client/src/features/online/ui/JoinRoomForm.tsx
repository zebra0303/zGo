import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CharacterType } from "@/entities/online/model/types";
import { useOnlineStore } from "@/entities/online/model/store";
import { createMaskedError } from "@/shared/lib/errors/AppError";
import CharacterSelector from "./CharacterSelector";

interface JoinRoomFormProps {
  roomId: string;
  onJoined: () => void;
  hostCharacter?: CharacterType | null;
}

const JoinRoomForm = ({
  roomId,
  onJoined,
  hostCharacter,
}: JoinRoomFormProps) => {
  const { t } = useTranslation();
  const joinRoom = useOnlineStore((s) => s.joinRoom);

  const [nickname, setNickname] = useState("");
  const [character, setCharacter] = useState<CharacterType | null>(null);
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
      await joinRoom(roomId, nickname.trim(), character);
      onJoined();
    } catch (err) {
      const maskedErr = createMaskedError(err, "Failed to join room");
      setError(maskedErr.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ring-accent";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <div>
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
          {t("online.character", { defaultValue: "Character" })}
        </label>
        <CharacterSelector
          selected={character}
          onSelect={setCharacter}
          disabledCharacter={hostCharacter}
        />
      </div>

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-accent bg-accent-hover text-accent-foreground font-bold rounded-xl transition-all disabled:opacity-50 text-sm"
      >
        {isSubmitting
          ? "..."
          : t("online.joinGame", { defaultValue: "Join Game" })}
      </button>
    </form>
  );
};

export default JoinRoomForm;
