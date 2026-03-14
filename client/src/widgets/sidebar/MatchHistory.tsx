import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PlayerColor } from "@/shared/types/board";
import { getMatchById, deleteMatch } from "@/shared/api/gameApi";

interface MatchRecord {
  id: string | number;
  mode: string;
  aiDifficulty: number;
  humanColor: string;
  winner: string;
  date: string;
  sgfData: string;
}

interface MatchHistoryProps {
  matches: MatchRecord[] | undefined;
  onRefetchMatches: () => void;
  onLoadMatch: (
    moves: ({ x: number; y: number } | null)[],
    winRates?: number[],
    resultText?: string,
    boardSize?: number,
    handicap?: number,
    winner?: PlayerColor | "DRAW" | null,
  ) => void;
  onStartReviewAnalysis: (
    moves: ({ x: number; y: number } | null)[],
    winRates?: number[],
  ) => void;
  onSetActiveTab: (tab: "game" | "history") => void;
  onShowConfirm: (
    message: string,
    onConfirm: () => void,
    title?: string,
  ) => void;
  onShowAlert: (message: string, title?: string) => void;
}

const MatchHistory = ({
  matches,
  onRefetchMatches,
  onLoadMatch,
  onStartReviewAnalysis,
  onSetActiveTab,
  onShowConfirm,
  onShowAlert,
}: MatchHistoryProps) => {
  const { t } = useTranslation();

  const stats = useMemo(
    () =>
      matches?.reduce(
        (
          acc: Record<string, { wins: number; losses: number }>,
          match: MatchRecord,
        ) => {
          if (match.mode !== "PvAI" || !match.aiDifficulty) return acc;
          const lv = String(match.aiDifficulty);
          if (!acc[lv]) acc[lv] = { wins: 0, losses: 0 };
          if (match.humanColor === match.winner) acc[lv].wins += 1;
          else acc[lv].losses += 1;
          return acc;
        },
        {},
      ) || {},
    [matches],
  );

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-thin scrollbar-thumb-gray-200">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md">
        <h2 className="text-sm font-bold mb-3">{t("aiStats")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(stats)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([lv, data]) => (
              <div
                key={lv}
                className="bg-white/10 rounded-lg p-2 border border-white/10"
              >
                <div className="text-[9px] uppercase font-bold opacity-70">
                  Lv {lv}
                </div>
                <div className="text-xs font-black">
                  {(data as { wins: number; losses: number }).wins}
                  {t("win")} /{" "}
                  {(data as { wins: number; losses: number }).losses}
                  {t("lose")}
                </div>
              </div>
            ))}
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
          {t("matchList")}
        </h2>
        {matches?.map((match) => (
          <div
            key={match.id}
            className="bg-white border rounded-xl p-3 shadow-sm hover:border-blue-300 cursor-pointer flex justify-between items-center group relative"
          >
            <div
              className="flex-1"
              onClick={async () => {
                const f = await getMatchById(match.id);
                const parsedData = JSON.parse(f.match.sgfData);
                let resultText = parsedData.resultText;
                let winnerColor: PlayerColor | "DRAW" | null = null;
                if (parsedData.resultWinner || match.winner) {
                  const winner =
                    parsedData.resultWinner || (match.winner as PlayerColor);
                  const scoreMatch = parsedData.resultText?.match(/([0-9.]+)/);
                  if (
                    scoreMatch &&
                    !parsedData.resultText?.includes(t("resign") || "기권")
                  ) {
                    const winnerName =
                      winner === "BLACK" ? t("black") : t("white");
                    resultText = t("winByScore", {
                      winner: winnerName,
                      diff: scoreMatch[1],
                    });
                  } else {
                    const loser = winner === "BLACK" ? t("white") : t("black");
                    const winnerName =
                      winner === "BLACK" ? t("black") : t("white");
                    resultText = t("resignWin", { loser, winner: winnerName });
                  }
                  winnerColor = winner;
                }
                onLoadMatch(
                  parsedData.moves,
                  parsedData.winRates,
                  resultText,
                  parsedData.boardSize,
                  parsedData.handicap,
                  winnerColor,
                );
                onStartReviewAnalysis(parsedData.moves, parsedData.winRates);
                onSetActiveTab("game");
              }}
            >
              <div className="flex justify-between mb-1">
                <span className="font-bold text-sm">
                  {match.mode === "PvAI"
                    ? `AI Lv.${match.aiDifficulty}`
                    : t("friendlyMatch")}
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    match.mode === "PvAI"
                      ? match.humanColor === match.winner
                        ? "text-blue-600"
                        : "text-red-500"
                      : match.winner === "BLACK"
                        ? "text-gray-800"
                        : "text-gray-400"
                  }`}
                >
                  {match.mode === "PvAI"
                    ? match.humanColor === match.winner
                      ? t("win")
                      : t("lose")
                    : match.winner === "BLACK"
                      ? t("blackWins")
                      : t("whiteWins")}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 flex justify-between">
                <span>{new Date(match.date).toLocaleDateString()}</span>
                <span>{t("reviewGo")}</span>
              </div>
            </div>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                onShowConfirm(
                  t("askDelete"),
                  async () => {
                    try {
                      await deleteMatch(match.id);
                      onRefetchMatches();
                    } catch (err) {
                      console.error("Failed to delete match", err);
                      onShowAlert(t("deleteFailed"), t("error"));
                    }
                  },
                  t("deleteConfirm"),
                );
              }}
              className="ml-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="삭제"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(MatchHistory);
