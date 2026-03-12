import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/entities/match/model/store";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchAIMove,
  fetchAIScore,
  saveMatch,
  getMatches,
  getMatchById,
  deleteMatch,
} from "@/shared/api/gameApi";
import { playStoneSound } from "@/shared/lib/sound";
import CustomDialog from "@/shared/ui/CustomDialog";

const SidebarWidget = () => {
  const { t, i18n } = useTranslation();
  const {
    board,
    currentPlayer,
    isTeacherMode,
    toggleTeacherMode,
    currentMoveIndex,
    history: gameHistory,
    gameMode,
    aiDifficulty,
    humanPlayerColor,
    setGameConfig,
    placeStone,
    passTurn,
    resignGame,
    resetGame,
    isGameOver,
    moveCoordinates,
    isReviewMode,
    loadMatch,
    capturedByBlack,
    capturedByWhite,
    boardScale,
    soundEnabled,
    soundVolume,
    teacherVisits,
    consecutivePasses,
    winRates,
    updateWinRate,
    language,
    boardSize,
    handicap,
    setDeadStones,
    deadStones,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<"game" | "history">("game");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [gameResultText, setGameResultText] = useState<string | null>(null);
  const [isScoring, setIsScoring] = useState(false);
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
    onConfirm: () => { },
  });

  const showAlert = useCallback((message: string, title: string = t('alert')) => {
    setDialog({
      isOpen: true,
      type: "alert",
      title,
      message,
      onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  }, [t]);

  const showConfirm = (
    message: string,
    onConfirm: () => void,
    title: string = t('confirm'),
  ) => {
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
  };

  // 대국 기록 가져오기
  const { data: matchesData, refetch: refetchMatches } = useQuery({
    queryKey: ["matches"],
    queryFn: () => getMatches(),
    enabled: activeTab === "history",
  });

  // AI 자동 착수 로직 (API 연동)
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
      try {
        const response = await fetchAIMove(
          board,
          currentPlayer,
          aiDifficulty,
          moveCoordinates.slice(1, currentMoveIndex + 1),
          abortController.signal,
          language,
          boardSize,
          handicap,
        );
        if (!isActive) return;

        if (response.pass) {
          passTurn();
          showAlert(t('aiPassed'));
        } else if (response.resign) {
          resignGame();
          showAlert(t('aiResignedMsg'), t('congrats'));
        } else if (response.move) {
          placeStone(response.move.x, response.move.y);
          playStoneSound(soundEnabled, soundVolume);
        }
        if (response.winRate) {
          const blackWinRate =
            currentPlayer === "BLACK"
              ? response.winRate
              : 100 - response.winRate;
          updateWinRate(useGameStore.getState().currentMoveIndex, blackWinRate);
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
      const timer = setTimeout(() => playAITurn(), 1500); // 1.5s delay
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
    moveCoordinates,
    currentMoveIndex,
    updateWinRate,
    showAlert,
    t,
    language,
    boardSize,
    handicap,
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

  useEffect(() => {
    const isEndOfReview =
      isReviewMode &&
      gameHistory.length > 1 &&
      currentMoveIndex === gameHistory.length - 1;

    if (isGameOver || isEndOfReview) {
      if (!gameResultText && !isScoring) {
        // Find if this was a natural end (pass, pass)
        let isNaturalEnd = false;
        if (isGameOver && consecutivePasses >= 2) {
          isNaturalEnd = true;
        } else if (isEndOfReview) {
          const lastMove = moveCoordinates[moveCoordinates.length - 1];
          const prevMove =
            moveCoordinates.length > 1
              ? moveCoordinates[moveCoordinates.length - 2]
              : undefined;
          if (lastMove === null && prevMove === null) {
            isNaturalEnd = true;
          }
        }

        if (!isNaturalEnd) {
          const loserColor = currentPlayer === "BLACK" ? t('black') : t('white');
          const winnerColor = currentPlayer === "BLACK" ? t('white') : t('black');
          // It's a resignation.
          setGameResultText(t('resignWin', { loser: loserColor, winner: winnerColor }));
          
          // Even on resignation, try to fetch dead stones for display
          fetchAIScore(
            moveCoordinates.slice(1, currentMoveIndex + 1),
            boardSize,
            handicap
          ).then(data => {
            if (data.deadStones) {
              console.log("[DEBUG] Resign - dead stones:", data.deadStones);
              setDeadStones(data.deadStones);
            }
          }).catch(() => {});
        } else {
          setIsScoring(true);
          fetchAIScore(
            moveCoordinates.slice(1, currentMoveIndex + 1),
            boardSize,
            handicap
          )
            .then((data) => {
              if (data.error === "NOT_FINISHED") {
                setGameResultText(t('calcError') + ": " + t('scoringNotReady', { defaultValue: "대국이 아직 종료되지 않았습니다" }));
              } else if (data.score) {
                const winner = data.score.startsWith("B")
                  ? t('black')
                  : data.score.startsWith("W")
                    ? t('white')
                    : null;
                if (winner) {
                  const diffMatch = data.score.match(/\+([0-9.]+)/);
                  const diff = diffMatch ? diffMatch[1] : "";
                  setGameResultText(t('winByScore', { winner, diff }));
                } else {
                  setGameResultText(t('draw'));
                }
              } else {
                setGameResultText(t('calcError'));
              }

              // Always try to set dead stones if returned
              if (data.deadStones) {
                console.log("[DEBUG] Score - dead stones:", data.deadStones);
                setDeadStones(data.deadStones);
              }
            })
            .catch((err) => {
              console.error(err);
              setGameResultText(t('calcFail'));
            })
            .finally(() => setIsScoring(false));
        }
      }
    } else {
      if (gameResultText !== null) setGameResultText(null);
    }
  }, [
    isGameOver,
    isReviewMode,
    currentMoveIndex,
    gameHistory.length,
    consecutivePasses,
    currentPlayer,
    moveCoordinates,
    gameResultText,
    isScoring,
    t,
    boardSize,
    handicap,
    setDeadStones,
  ]);

  // Reset status when move index changes
  useEffect(() => {
    if (!isGameOver && !isReviewMode) {
      setSaveStatus("idle");
      setGameResultText(null);
    }
  }, [currentMoveIndex, isGameOver, isReviewMode]);

  const handleSaveMatch = () => {
    let winnerColor: "BLACK" | "WHITE" = "BLACK";
    
    // Determine winner based on result text
    if (gameResultText) {
      if (gameResultText.includes(t('black')) && (
        gameResultText.includes(t('win')) || 
        gameResultText.includes(t('winByScore', { winner: '', diff: '' }).replace(': {{winner}} {{diff}}집승', '').trim())
      )) {
        winnerColor = "BLACK";
      } else if (gameResultText.includes(t('white'))) {
        winnerColor = "WHITE";
      }
    } else {
      const finalWinRateBlack = winRates[currentMoveIndex] ?? 50;
      winnerColor = finalWinRateBlack > 50 ? "BLACK" : "WHITE";
    }

    const matchData = {
      mode: gameMode,
      aiDifficulty: gameMode === "PvAI" ? aiDifficulty : null,
      humanColor: humanPlayerColor,
      winner: winnerColor,
      sgfData: JSON.stringify({
        moves: moveCoordinates,
        winRates,
        resultText: gameResultText,
      }),
    };
    saveMutation.mutate(matchData);
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setGameConfig({ language: lng as "ko" | "en" });
  };

  const stats =
    matchesData?.matches?.reduce(
      (
        acc: Record<string, { wins: number; losses: number }>,
        match: Record<string, unknown>,
      ) => {
        if (match.mode !== "PvAI" || !match.aiDifficulty) return acc;
        const lv = String(match.aiDifficulty);
        if (!acc[lv]) acc[lv] = { wins: 0, losses: 0 };
        if (match.humanColor === match.winner) acc[lv].wins += 1;
        else acc[lv].losses += 1;
        return acc;
      },
      {},
    ) || {};

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
        <p className="text-sm text-gray-500 font-medium">{t('subtitle')}</p>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-lg mb-6 shrink-0">
        <button
          onClick={() => setActiveTab("game")}
          className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === "game" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          {t('tabGame')}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === "history" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          {t('tabHistory')}
        </button>
      </div>

      {activeTab === "game" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0">
            {isReviewMode && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl shadow-sm flex flex-col gap-2 mb-4">
                <div className="font-bold flex items-center justify-between">
                  <span>{t('reviewModeOn')}</span>
                  <button
                    onClick={resetGame}
                    className="text-xs bg-amber-200 hover:bg-amber-300 px-2 py-1 rounded transition-colors"
                  >
                    {t('backToGame')}
                  </button>
                </div>
                {currentMoveIndex === gameHistory.length - 1 &&
                  (gameResultText || isScoring) && (
                    <div className="text-sm font-extrabold text-amber-900 bg-amber-100/50 rounded p-1.5 text-center">
                      {isScoring ? t('resultScoring') : t('result', { text: gameResultText })}
                    </div>
                  )}
              </div>
            )}

            {isGameOver ? (
              <div className="bg-red-50 text-red-800 p-4 rounded-xl mb-4 shadow-inner text-center font-bold text-lg border border-red-200">
                <div className="mb-2">{t('gameOver')}</div>
                {gameResultText ? (
                  <div className="text-xl text-red-600 mb-3 drop-shadow-sm font-extrabold">
                    {gameResultText}
                  </div>
                ) : isScoring ? (
                  <div className="text-sm text-gray-500 mb-3">{t('scoring')}</div>
                ) : null}
                <div className="text-xs mb-3 flex justify-center gap-4 text-gray-600 font-medium">
                  <span className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-black"></div>{" "}
                    {t('capturedBlack', { count: capturedByBlack })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300"></div>{" "}
                    {t('capturedWhite', { count: capturedByWhite })}
                  </span>
                </div>
                {deadStones && deadStones.length > 0 && (
                  <div className="text-[10px] text-red-500 font-bold mb-2 animate-pulse">
                    ⚠️ {deadStones.length} dead stones identified on board
                  </div>
                )}
                <button
                  onClick={handleSaveMatch}
                  disabled={saveStatus !== "idle"}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition-colors text-sm disabled:opacity-50"
                >
                  {saveStatus === "idle"
                    ? t('saveRecord')
                    : saveStatus === "saving"
                      ? t('saving')
                      : saveStatus === "saved"
                        ? t('saved')
                        : t('saveFailed')}
                </button>
              </div>
            ) : (
              <div className="bg-gray-100 p-4 rounded-xl mb-4 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 font-semibold">
                    {t('currentTurn')}
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full shadow-sm border ${currentPlayer === "BLACK" ? "bg-black border-gray-800" : "bg-white border-gray-300"}`}
                    ></div>
                    <span className="font-bold text-lg">
                      {currentPlayer === "BLACK" ? t('black') : t('white')}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between text-[10px] font-bold text-gray-500">
                  <span>{t('capturedBlack', { count: capturedByBlack })}</span>
                  <span>{t('capturedWhite', { count: capturedByWhite })}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-200">
            {/* 설정 카드 */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-700 flex items-center gap-2 mb-2">
                <span className="text-xl">⚙️</span> {t('settings').replace('⚙️ ', '')}
              </h2>

              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-600">{t('language')}</span>
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
                <span className="font-medium text-gray-600">{t('mode')}</span>
                <select
                  value={gameMode}
                  onChange={(e) => {
                    setGameConfig({ gameMode: e.target.value as "PvP" | "PvAI" });
                    resetGame();
                  }}
                  className="bg-gray-50 border border-gray-200 rounded p-1 text-xs"
                >
                  <option value="PvP">{t('pvp')}</option>
                  <option value="PvAI">{t('pvai')}</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50">
                <span className="font-medium text-gray-600">{t('teacherMode')}</span>
                <button
                  onClick={toggleTeacherMode}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isTeacherMode ? "bg-blue-600" : "bg-gray-300"}`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isTeacherMode ? "translate-x-5" : "translate-x-1"}`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50">
                <span className="font-medium text-gray-600">{t('boardSize')}</span>
                <select
                  value={boardSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    if (newSize <= 9 && handicap > 0) {
                      setGameConfig({ boardSize: newSize, handicap: 0 });
                    } else if (newSize > 9 && handicap > newSize - 9) {
                      setGameConfig({ boardSize: newSize, handicap: Math.min(9, newSize - 9) });
                    } else {
                      setGameConfig({ boardSize: newSize });
                    }
                    resetGame();
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
                <span className="font-medium text-gray-600">{t('handicap')}</span>
                <select
                  value={handicap}
                  onChange={(e) => {
                    setGameConfig({ handicap: Number(e.target.value) });
                    resetGame();
                  }}
                  className="bg-gray-50 border border-gray-200 rounded p-1 text-xs"
                  disabled={boardSize <= 9}
                >
                  <option value="0">0</option>
                  {boardSize > 9 && Array.from({ length: Math.min(9, boardSize - 9) - 1 }, (_, i) => i + 2).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {gameMode === "PvAI" && (
                <div className="space-y-3 pt-1 border-t border-gray-50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-600">{t('myStone')}</span>
                    <select
                      value={humanPlayerColor}
                      onChange={(e) => {
                        setGameConfig({
                          humanPlayerColor: e.target.value as "BLACK" | "WHITE",
                        });
                        resetGame();
                      }}
                      className="bg-gray-50 border border-gray-200 rounded p-1 text-xs"
                    >
                      <option value="BLACK">{t('blackFirst')}</option>
                      <option value="WHITE">{t('whiteSecond')}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-600">{t('aiDifficulty')}</span>
                      <span className="font-bold text-blue-600">
                        Lv. {aiDifficulty}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
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
                  <span className="text-gray-600">{t('boardZoom')}</span>
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
                <span className="text-sm font-medium text-gray-600">
                  {t('sound')}
                </span>
                <button
                  onClick={() => setGameConfig({ soundEnabled: !soundEnabled })}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${soundEnabled ? "bg-blue-600" : "bg-gray-300"}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${soundEnabled ? "translate-x-5" : "translate-x-1"}`}
                  />
                </button>
              </div>

              {soundEnabled && (
                <div className="space-y-1 pt-1 border-t border-gray-50 mt-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600">{t('volume', { defaultValue: 'Volume' })}</span>
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
                  />
                </div>
              )}

              <div className="space-y-1 pt-1 border-t border-gray-50 mt-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-600">{t('teacherLevel')}</span>
                  <span className="font-bold text-blue-600">
                    {teacherVisits}
                  </span>
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

              <div className="flex gap-2 pt-2 border-t border-gray-50">
                <button
                  onClick={() => {
                    resetGame();
                    setSaveStatus("idle");
                  }}
                  className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-[10px] border border-red-200 uppercase tracking-tighter"
                >
                  {t('newGame')}
                </button>
                {!isGameOver && (
                  <>
                    <button
                      onClick={passTurn}
                      className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-[10px] border border-gray-300 uppercase tracking-tighter"
                    >
                      {t('pass')}
                    </button>
                    <button
                      onClick={() => {
                        showConfirm(
                          t('askResign'),
                          resignGame,
                          t('doResign'),
                        );
                      }}
                      className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-[10px] border border-gray-300 uppercase tracking-tighter"
                    >
                      {t('resign')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-thin scrollbar-thumb-gray-200">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md">
            <h2 className="text-sm font-bold mb-3">{t('aiStats')}</h2>
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
                      {(data as { wins: number; losses: number }).wins}{t('win')} /{" "}
                      {(data as { wins: number; losses: number }).losses}{t('lose')}
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
              {t('matchList')}
            </h2>
            {matchesData?.matches?.map(
              (match: {
                id: string | number;
                mode: string;
                aiDifficulty: number;
                humanColor: string;
                winner: string;
                date: string;
                sgfData: string;
              }) => (
                <div
                  key={match.id}
                  className="bg-white border rounded-xl p-3 shadow-sm hover:border-blue-300 cursor-pointer flex justify-between items-center group relative"
                >
                  <div
                    className="flex-1"
                    onClick={async () => {
                      const f = await getMatchById(match.id);
                      const parsedData = JSON.parse(f.match.sgfData);
                      loadMatch(parsedData.moves, parsedData.winRates);
                      setActiveTab("game");
                    }}
                  >
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-sm">
                        {match.mode === "PvAI"
                          ? `AI Lv.${match.aiDifficulty}`
                          : t('friendlyMatch')}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${match.humanColor === match.winner ? "text-blue-600" : "text-red-500"}`}
                      >
                        {match.humanColor === match.winner ? t('win') : t('lose')}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 flex justify-between">
                      <span>{new Date(match.date).toLocaleDateString()}</span>
                      <span>{t('reviewGo')}</span>
                    </div>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      showConfirm(
                        t('askDelete'),
                        async () => {
                          try {
                            await deleteMatch(match.id);
                            refetchMatches();
                          } catch (err) {
                            console.error("Failed to delete match", err);
                            showAlert(t('deleteFailed'), t('error'));
                          }
                        },
                        t('deleteConfirm'),
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
              ),
            )}
          </div>
        </div>
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
