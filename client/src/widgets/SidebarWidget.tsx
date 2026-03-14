import {
  useEffect,
  useState,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { useTranslation } from "react-i18next";
import { useGameStore, getPathToNode } from "@/entities/match/model/store";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchAIMove,
  fetchAIScore,
  saveMatch,
  getMatches,
  analyzeGame,
} from "@/shared/api/gameApi";
import {
  playStoneSound,
  playWinSound,
  playLoseSound,
} from "@/shared/lib/sound";
import CustomDialog from "@/shared/ui/CustomDialog";
import GameStatusPanel from "@/widgets/sidebar/GameStatusPanel";
import SettingsPanel from "@/widgets/sidebar/SettingsPanel";

const MatchHistory = lazy(() => import("@/widgets/sidebar/MatchHistory"));

const SidebarWidget = () => {
  const { t } = useTranslation();
  const {
    board,
    currentPlayer,
    currentNode,
    gameMode,
    aiDifficulty,
    humanPlayerColor,
    placeStone,
    passTurn,
    resignGame,
    isGameOver,
    isReviewMode,
    loadMatch,
    soundEnabled,
    soundVolume,
    consecutivePasses,
    updateWinRate,
    language,
    boardSize,
    handicap,
    setDeadStones,
    gameResultText,
    winner,
    setGameResultText,
    setWinner,
    setIsScoring,
    gameTree,
  } = useGameStore();

  const playedGameOverSoundRef = useRef(false);
  const scoringNodeRef = useRef<string | null>(null);

  // Helper to get moves up to current node
  const getMoveHistory = useCallback(() => {
    const path = getPathToNode(gameTree, currentNode.id) || [currentNode];
    const moves: ({ x: number; y: number } | null)[] = [];
    for (let i = 1; i < path.length; i++) {
      const node = path[i];
      moves.push(
        node.x !== null && node.y !== null ? { x: node.x, y: node.y } : null,
      );
    }
    return moves;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode.id, gameTree]);

  const analysisAbortRef = useRef<AbortController | null>(null);

  const startReviewAnalysis = useCallback(
    (moves: ({ x: number; y: number } | null)[], winRates?: number[]) => {
      if (winRates && winRates.some((r) => r !== 50)) return;
      if (moves.length <= 1) return;

      analysisAbortRef.current?.abort();
      const abortController = new AbortController();
      analysisAbortRef.current = abortController;

      const total = moves.length - 1;
      const storeState = useGameStore.getState();
      const tree = storeState.gameTree;
      const savedBoardSize = storeState.boardSize;
      const savedHandicap = storeState.handicap;

      storeState.setIsAnalyzing(true);
      storeState.setAnalysisProgress({ current: 0, total });

      const nodeIds: string[] = ["root"];
      let node = tree;
      while (node.children.length > 0) {
        node = node.children[0];
        nodeIds.push(node.id);
      }

      let lastUpdateTime = performance.now();
      let pendingUpdates: { nodeId: string; winRate: number }[] = [];

      analyzeGame(
        moves,
        savedBoardSize,
        savedHandicap,
        (moveIndex, winRate) => {
          if (nodeIds[moveIndex]) {
            pendingUpdates.push({ nodeId: nodeIds[moveIndex], winRate });
          }

          const now = performance.now();
          if (now - lastUpdateTime > 100 || moveIndex === total) {
            const store = useGameStore.getState();
            if (pendingUpdates.length > 0) {
              store.updateWinRates(pendingUpdates);
              pendingUpdates = [];
            }
            store.setAnalysisProgress({ current: moveIndex, total });
            lastUpdateTime = now;
          }
        },
        abortController.signal,
      )
        .then(() => {
          const store = useGameStore.getState();
          if (pendingUpdates.length > 0) {
            store.updateWinRates(pendingUpdates);
          }
          store.setIsAnalyzing(false);
          store.setAnalysisProgress(null);
        })
        .catch((err) => {
          if (err.name !== "AbortError") console.error("Analysis failed:", err);
          const store = useGameStore.getState();
          store.setIsAnalyzing(false);
          store.setAnalysisProgress(null);
        });
    },
    [],
  );

  // Cancel analysis when leaving review mode
  useEffect(() => {
    if (!isReviewMode) {
      analysisAbortRef.current?.abort();
    }
  }, [isReviewMode]);

  const [activeTab, setActiveTab] = useState<"game" | "history">("game");
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

  // 대국 기록 가져오기
  const { data: matchesData, refetch: refetchMatches } = useQuery({
    queryKey: ["matches"],
    queryFn: () => getMatches(),
    enabled: activeTab === "history",
  });

  // AI 자동 착수 로직
  useEffect(() => {
    let isActive = true;
    const abortController = new AbortController();

    const playAITurn = async () => {
      if (
        isGameOver ||
        isReviewMode ||
        gameMode !== "PvAI" ||
        currentPlayer === humanPlayerColor
      )
        return;

      const moveHistory = getMoveHistory();

      try {
        const response = await fetchAIMove(
          board,
          currentPlayer,
          aiDifficulty,
          moveHistory,
          abortController.signal,
          language,
          boardSize,
          handicap,
        );
        if (!isActive) return;

        if (response.winRate) {
          const blackWinRate =
            currentPlayer === "BLACK"
              ? response.winRate
              : 100 - response.winRate;
          updateWinRate(currentNode.id, blackWinRate);
        }

        if (response.pass) {
          passTurn();
          showAlert(t("aiPassed"));
        } else if (response.resign) {
          resignGame();
          showAlert(t("aiResignedMsg"), t("congrats"));
        } else if (response.move) {
          placeStone(response.move.x, response.move.y);
          playStoneSound(soundEnabled, soundVolume);
        }
      } catch (err) {
        const error = err as Error;
        if (
          error?.name !== "AbortError" &&
          !error?.message?.includes("abort")
        ) {
          console.error("AI Move Error:", error);
        }
      }
    };

    if (
      !isGameOver &&
      !isReviewMode &&
      gameMode === "PvAI" &&
      currentPlayer !== humanPlayerColor
    ) {
      const timer = setTimeout(() => playAITurn(), 1500);
      return () => {
        isActive = false;
        clearTimeout(timer);
        abortController.abort();
      };
    }
    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [
    gameMode,
    currentPlayer,
    humanPlayerColor,
    board,
    isGameOver,
    isReviewMode,
    placeStone,
    passTurn,
    resignGame,
    soundEnabled,
    soundVolume,
    aiDifficulty,
    getMoveHistory,
    updateWinRate,
    showAlert,
    t,
    language,
    boardSize,
    handicap,
    currentNode.id,
  ]);

  const saveMutation = useMutation({
    mutationFn: saveMatch,
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => {
      setSaveStatus("saved");
      refetchMatches();
    },
    onError: () => setSaveStatus("error"),
  });

  // Game-over / end-of-branch scoring effect
  useEffect(() => {
    const abortController = new AbortController();
    const isEndOfBranch =
      isReviewMode &&
      currentNode.children.length === 0 &&
      currentNode.id !== "root";

    if (isGameOver || isEndOfBranch) {
      if (scoringNodeRef.current === currentNode.id) return;
      scoringNodeRef.current = currentNode.id;

      const moveHistory = getMoveHistory();

      let isNaturalEnd = false;
      if (isGameOver && consecutivePasses >= 2) {
        isNaturalEnd = true;
      } else if (isEndOfBranch) {
        const lastMove = moveHistory[moveHistory.length - 1];
        const prevMove =
          moveHistory.length > 1
            ? moveHistory[moveHistory.length - 2]
            : undefined;
        if (lastMove === null && prevMove === null) {
          isNaturalEnd = true;
        }
      }

      if (!isNaturalEnd) {
        const loserColor = currentPlayer === "BLACK" ? "BLACK" : "WHITE";
        const winnerColor = currentPlayer === "BLACK" ? "WHITE" : "BLACK";
        const loserName = loserColor === "BLACK" ? t("black") : t("white");
        const winnerName = winnerColor === "BLACK" ? t("black") : t("white");

        setWinner(winnerColor);
        setGameResultText(
          t("resignWin", { loser: loserName, winner: winnerName }),
        );

        fetchAIScore(moveHistory, boardSize, handicap, abortController.signal)
          .then((data) => {
            if (data.deadStones) {
              setDeadStones(data.deadStones);
            }
          })
          .catch(() => {});
      } else {
        setIsScoring(true);
        fetchAIScore(moveHistory, boardSize, handicap, abortController.signal)
          .then((data) => {
            if (data.error === "NOT_FINISHED") {
              setGameResultText(
                t("calcError") +
                  ": " +
                  t("scoringNotReady", {
                    defaultValue: "대국이 아직 종료되지 않았습니다",
                  }),
              );
            } else if (data.score) {
              const winnerColor = data.score.startsWith("B")
                ? "BLACK"
                : "WHITE";
              const winnerName =
                winnerColor === "BLACK" ? t("black") : t("white");

              setWinner(winnerColor);
              const diffMatch = data.score.match(/\+([0-9.]+)/);
              const diff = diffMatch ? diffMatch[1] : "";
              setGameResultText(t("winByScore", { winner: winnerName, diff }));
            } else {
              setGameResultText(t("calcError"));
            }

            if (data.deadStones) {
              setDeadStones(data.deadStones);
            }
          })
          .catch((err) => {
            if (err?.name !== "AbortError") console.error(err);
            setGameResultText(t("calcFail"));
          })
          .finally(() => setIsScoring(false));
      }
    } else {
      if (gameResultText !== null) setGameResultText(null);
      if (scoringNodeRef.current !== null) scoringNodeRef.current = null;
    }

    return () => abortController.abort();
  }, [
    isGameOver,
    isReviewMode,
    currentNode.id,
    currentNode.children.length,
    consecutivePasses,
    currentPlayer,
    getMoveHistory,
    t,
    boardSize,
    handicap,
    setDeadStones,
    setGameResultText,
    setWinner,
    setIsScoring,
    gameResultText,
  ]);

  // Reset status when move node changes
  useEffect(() => {
    if (!isGameOver && !isReviewMode) {
      setSaveStatus("idle");
      setGameResultText(null);
      playedGameOverSoundRef.current = false;
    }
  }, [currentNode.id, isGameOver, isReviewMode, setGameResultText]);

  // Handle Game Over Sounds
  useEffect(() => {
    if (
      isGameOver &&
      !isReviewMode &&
      !playedGameOverSoundRef.current &&
      winner
    ) {
      if (gameMode === "PvAI") {
        if (winner === humanPlayerColor) {
          playWinSound(soundEnabled, soundVolume);
        } else {
          playLoseSound(soundEnabled, soundVolume);
        }
      } else {
        // PvP Mode: Play win sound when game ends
        playWinSound(soundEnabled, soundVolume);
      }
      playedGameOverSoundRef.current = true;
    }
  }, [
    isGameOver,
    isReviewMode,
    winner,
    gameMode,
    humanPlayerColor,
    soundEnabled,
    soundVolume,
  ]);

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

  return (
    <div className="h-full flex flex-col p-6 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] bg-white overflow-hidden">
      <div className="mb-6 text-center shrink-0">
        <h1 className="text-3xl font-extrabold text-gray-800 mb-1 tracking-tight flex items-center justify-center gap-2">
          <img
            src="/zgo_logo.png"
            alt="zGo Logo"
            className="w-10 h-10 inline-block rounded-full object-cover shadow-sm"
          />
          zGo
        </h1>
        <p className="text-sm text-gray-500 font-medium">{t("subtitle")}</p>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-lg mb-6 shrink-0">
        <button
          onClick={() => setActiveTab("game")}
          className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === "game" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          {t("tabGame")}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === "history" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          {t("tabHistory")}
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

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-200">
            <SettingsPanel
              onResetSaveStatus={resetSaveStatus}
              onShowConfirm={showConfirm}
            />
          </div>
        </div>
      ) : (
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
      )}

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
