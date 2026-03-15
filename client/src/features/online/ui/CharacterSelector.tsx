import { CHARACTERS, CharacterType } from "@/entities/online/model/types";

interface CharacterSelectorProps {
  selected: CharacterType | null;
  onSelect: (character: CharacterType) => void;
  disabledCharacter?: CharacterType | null;
}

const CharacterSelector = ({
  selected,
  onSelect,
  disabledCharacter,
}: CharacterSelectorProps) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CHARACTERS.map((char) => {
        const isDisabled = char.id === disabledCharacter;
        return (
          <button
            key={char.id}
            type="button"
            onClick={() => !isDisabled && onSelect(char.id)}
            disabled={isDisabled}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
              isDisabled
                ? "border-gray-100 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-40 cursor-not-allowed"
                : selected === char.id
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 shadow-sm scale-105"
                  : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
            }`}
          >
            <span className="text-3xl">{char.emoji}</span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
              {char.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CharacterSelector;
