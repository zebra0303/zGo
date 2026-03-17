import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  useGameStore,
  getPathToNode,
  startReviewAnalysis,
} from "@/entities/match/model/store";
import { useQuery, useMutation } from "@tanstack/react-query";
import { saveMatch, getMatches } from "@/shared/api/gameApi";
import CustomDialog from "@/shared/ui/CustomDialog";
import GameStatusPanel from "@/widgets/sidebar/GameStatusPanel";
import SettingsPanel from "@/widgets/sidebar/SettingsPanel";
import { buildMoveHistory } from "@/shared/lib/goUtils";

const MatchHistory = lazy(() => import("@/widgets/sidebar/MatchHistory"));
const AdminPanel = lazy(() => import("@/widgets/sidebar/AdminPanel"));

const SidebarWidget = () => {
  const { t } = useTranslation();
  const {
    currentNode,
    gameMode,
    aiDifficulty,
    humanPlayerColor,
    isGameOver,
    isReviewMode,
    loadMatch,
    boardSize,
    handicap,
    gameResultText,
    winner,
    setGameResultText,
    gameTree,
  } = useGameStore();

  const getMoveHistory = useCallback(() => {
    const path = getPathToNode(gameTree, currentNode.id) || [currentNode];
    return buildMoveHistory(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode.id, gameTree]);

  const [activeTab, setActiveTab] = useState<"game" | "history" | "admin">(
    "game",
  );
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: "alert" | "confirm";
    title?: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: "alert",
    message: "",
    onConfirm: () => {},
  });

  const showAlert = useCallback(
    (message: string, title: string = t("alert")) => {
      setDialog({
        isOpen: true,
        type: "alert",
        title,
        message,
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    },
    [t],
  );

  const showConfirm = useCallback(
    (message: string, onConfirm: () => void, title: string = t("confirm")) => {
      setDialog({
        isOpen: true,
        type: "confirm",
        title,
        message,
        onConfirm: () => {
          onConfirm();
          setDialog((prev) => ({ ...prev, isOpen: false }));
        },
        onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    },
    [t],
  );

  const { data: matchesData, refetch: refetchMatches } = useQuery({
    queryKey: ["matches"],
    queryFn: () => getMatches(),
    enabled: activeTab === "history",
  });

  const saveMutation = useMutation({
    mutationFn: saveMatch,
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => {
      setSaveStatus("saved");
      refetchMatches();
    },
    onError: () => setSaveStatus("error"),
  });

  // Reset save status when move node changes during active play
  useEffect(() => {
    if (!isGameOver && !isReviewMode) {
      setSaveStatus("idle");
      setGameResultText(null);
    }
  }, [currentNode.id, isGameOver, isReviewMode, setGameResultText]);

  const handleSaveMatch = useCallback(() => {
    let winnerColor: "BLACK" | "WHITE" =
      winner === "DRAW" || !winner ? "BLACK" : winner;

    if (!winner && gameResultText) {
      const blackName = t("black");
      const whiteName = t("white");
      const resignBlackWin = t("resignWin", {
        loser: whiteName,
        winner: blackName,
      });
      const scoreBlackWin =
        gameResultText.startsWith(blackName) &&
        !gameResultText.includes(t("resign"));

      if (gameResultText === resignBlackWin || scoreBlackWin) {
        winnerColor = "BLACK";
      } else {
        winnerColor = "WHITE";
      }
    } else if (!winner) {
      winnerColor = currentNode.winRate > 50 ? "BLACK" : "WHITE";
    }

    const moveHistory = getMoveHistory();
    const path = getPathToNode(gameTree, currentNode.id) || [currentNode];
    const winRates = path.map((node) => node.winRate);

    const matchData = {
      mode: gameMode,
      aiDifficulty: gameMode === "PvAI" ? aiDifficulty : null,
      humanColor: humanPlayerColor,
      winner: winnerColor,
      sgfData: JSON.stringify({
        moves: [null, ...moveHistory],
        winRates,
        resultText: gameResultText,
        resultWinner: winnerColor,
        boardSize,
        handicap,
      }),
    };
    saveMutation.mutate(matchData);
  }, [
    winner,
    gameResultText,
    t,
    currentNode,
    getMoveHistory,
    gameTree,
    gameMode,
    aiDifficulty,
    humanPlayerColor,
    boardSize,
    handicap,
    saveMutation,
  ]);

  const resetSaveStatus = useCallback(() => setSaveStatus("idle"), []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("admin_token");
    window.location.reload();
  }, []);

  return (
    <div className="h-full flex flex-col p-4 md:p-6 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] bg-white dark:bg-gray-900 overflow-hidden">
      <div className="mb-3 md:mb-6 text-center shrink-0">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100 mb-1 tracking-tight flex items-center justify-center gap-2">
          <img
            src="/zgo_logo.png"
            alt="zGo Logo"
            className="w-10 h-10 inline-block rounded-full object-cover shadow-sm"
          />
          zGo
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-6 shrink-0">
        <button
          onClick={() => setActiveTab("game")}
          className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === "game" ? "bg-white dark:bg-gray-700 text-accent shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"}`}
        >
          {t("tabGame")}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === "history" ? "bg-white dark:bg-gray-700 text-accent shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"}`}
        >
          {t("tabHistory")}
        </button>
        <button
          onClick={() => setActiveTab("admin")}
          className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === "admin" ? "bg-white dark:bg-gray-700 text-accent shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"}`}
        >
          ⚙️ {t("admin.title")}
        </button>
      </div>

      {activeTab === "game" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0">
            <GameStatusPanel
              saveStatus={saveStatus}
              onSaveMatch={handleSaveMatch}
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            <SettingsPanel
              onResetSaveStatus={resetSaveStatus}
              onShowConfirm={showConfirm}
            />
          </div>
        </div>
      ) : activeTab === "history" ? (
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse">
              {t("loading", { defaultValue: "Loading..." })}
            </div>
          }
        >
          <MatchHistory
            matches={matchesData?.matches}
            onRefetchMatches={refetchMatches}
            onLoadMatch={loadMatch}
            onStartReviewAnalysis={startReviewAnalysis}
            onSetActiveTab={setActiveTab}
            onShowConfirm={showConfirm}
            onShowAlert={showAlert}
          />
        </Suspense>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse">
                Loading...
              </div>
            }
          >
            <AdminPanel onLogout={handleLogout} />
          </Suspense>
        </div>
      )}

      <div className="mt-4 text-center text-xs text-gray-400 shrink-0">
        Powered by{" "}
        <a
          href="https://github.com/zebra0303/zGo"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          zGo
        </a>
      </div>

      <CustomDialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />
    </div>
  );
};

export default SidebarWidget;
