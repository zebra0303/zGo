import { TFunction } from "i18next";

export const formatGameResultText = (
  text: string | null,
  t: TFunction,
): string | null => {
  if (!text) return null;
  if (text === "Draw") return t("draw");

  // Regex for "Black +1.5" or "White +35.5"
  const scoreMatch = text.match(/^(Black|White|BLACK|WHITE)\s*\+([0-9.]+)$/i);
  if (scoreMatch) {
    const winnerName =
      scoreMatch[1].toUpperCase() === "BLACK" ? t("black") : t("white");
    return t("winByScore", {
      winner: winnerName,
      diff: scoreMatch[2],
    });
  }

  // Regex for "BLACK wins (WHITE resigned)" or "Black wins (opponent left)"
  const resignMatch = text.match(
    /^(Black|White|BLACK|WHITE)\s+wins\s+\((.+)\)$/i,
  );
  if (resignMatch) {
    const winnerColor =
      resignMatch[1].toUpperCase() === "BLACK" ? "BLACK" : "WHITE";
    const winnerName = winnerColor === "BLACK" ? t("black") : t("white");
    const loserName = winnerColor === "BLACK" ? t("white") : t("black");

    // Check if reason is resignation
    if (resignMatch[2].toLowerCase().includes("resign")) {
      return t("resignWin", { loser: loserName, winner: winnerName });
    }
  }

  return text; // Return as-is if no specific format matched
};
