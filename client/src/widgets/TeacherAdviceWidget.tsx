import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/entities/match/model/store";
import { useQuery } from "@tanstack/react-query";
import { fetchAIHint } from "@/shared/api/gameApi";

const coordsToGtp = (x: number, y: number, boardSize: number) =>
  "ABCDEFGHJKLMNOPQRST"[x] + (boardSize - y);

const TeacherAdviceWidget = () => {
  const { t } = useTranslation();
  const {
    board,
    currentPlayer,
    isTeacherMode,
    currentMoveIndex,
    history: gameHistory,
    gameMode,
    aiDifficulty,
    humanPlayerColor,
    isGameOver,
    moveCoordinates,
    teacherVisits,
    ignoredRecommendation,
    setIgnoredRecommendation,
    teacherCritique,
    setTeacherCritique,
    updateWinRate,
    language,
    boardSize,
    handicap,
  } = useGameStore();

  const lastRecommendationRef = useRef<{
    recommendations?: { x: number; y: number; winRate?: number; visits?: number; gtpMove: string; explanation: string }[];
  } | null>(null);
  const fetchingCritiqueForIndex = useRef<number | null>(null);

  // API 호출을 통한 힌트 요청
  const { data: aiData, isFetching: isFetchingHint } = useQuery({
    queryKey: [
      "aiHint",
      currentMoveIndex,
      currentPlayer,
      aiDifficulty,
      teacherVisits,
      moveCoordinates,
      language,
      boardSize,
      handicap,
    ],
    queryFn: ({ signal }) =>
      fetchAIHint(
        board,
        currentPlayer,
        aiDifficulty,
        teacherVisits,
        moveCoordinates.slice(1, currentMoveIndex + 1),
        signal,
        language,
        boardSize,
        handicap,
      ),
    enabled:
      isTeacherMode &&
      !isGameOver &&
      (gameMode === "PvP" || currentPlayer === humanPlayerColor),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Update win rate in store when AI data is received
  useEffect(() => {
    if (aiData && aiData.winRate) {
      const blackWinRate =
        currentPlayer === "BLACK" ? aiData.winRate : 100 - aiData.winRate;
      updateWinRate(currentMoveIndex, blackWinRate);
    }
  }, [aiData, currentMoveIndex, updateWinRate, currentPlayer]);

  // Track the recommendation to contrast it later
  useEffect(() => {
    if (aiData?.recommendations) {
      lastRecommendationRef.current = aiData;
    }
  }, [aiData]);

  const fetchCritique = useCallback(
    async (
      userMove: { x: number; y: number },
      bestMoves: { x: number; y: number }[],
      moveIndex: number,
      signal: AbortSignal,
    ) => {
      if (fetchingCritiqueForIndex.current === moveIndex) return;
      fetchingCritiqueForIndex.current = moveIndex;

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api"}/ai/move`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              board: gameHistory[moveIndex - 1],
              currentPlayer: handicap > 0
                ? ((moveIndex - 1) % 2 === 0 ? "WHITE" : "BLACK")
                : ((moveIndex - 1) % 2 === 0 ? "BLACK" : "WHITE"),
              isHintRequest: true,
              aiDifficulty,
              teacherVisits,
              lastUserMove: userMove,
              lastRecommendations: bestMoves,
              moves: moveCoordinates.slice(1, moveIndex),
              language,
              boardSize,
              handicap,
            }),
            signal,
          },
        );
        const data = await response.json();

        const currentStoreState = useGameStore.getState();
        if (currentStoreState.currentMoveIndex === moveIndex && data.critique) {
          setTeacherCritique(data.critique);
          setIgnoredRecommendation(bestMoves);
        }
      } catch (err) {
        const e = err as Error;
        if (e?.name !== "AbortError" && !e?.message?.includes("abort")) {
          console.error("Critique fetch failed", e);
        }
      } finally {
        if (fetchingCritiqueForIndex.current === moveIndex) {
          fetchingCritiqueForIndex.current = null;
        }
      }
    },
    [
      aiDifficulty,
      gameHistory,
      teacherVisits,
      setIgnoredRecommendation,
      setTeacherCritique,
      moveCoordinates,
      language,
      boardSize,
      handicap,
    ],
  );

  // Listen for move changes to determine if we should show a critique
  useEffect(() => {
    if (!isTeacherMode || currentMoveIndex === 0) {
      setTeacherCritique(null);
      setIgnoredRecommendation(null);
      return;
    }

    const lastMove = moveCoordinates[currentMoveIndex];
    const rec = lastRecommendationRef.current;

    const moveColor = currentMoveIndex % 2 === 1 ? "BLACK" : "WHITE";    
    // Evaluate human move immediately, AI moves don't need human critique
    if (gameMode === "PvAI" && moveColor !== humanPlayerColor) {
      return;
    }

    // if gameMode is PvP or gameMode is PvAI and human moved
    const abortController = new AbortController();

    if (lastMove && rec?.recommendations && rec.recommendations.length > 0) {
      const isFollowed = rec.recommendations.some(r => r.x === lastMove.x && r.y === lastMove.y);
      if (!isFollowed) {
        fetchCritique(
          lastMove,
          rec.recommendations,
          currentMoveIndex,
          abortController.signal,
        );
      } else {
        setTeacherCritique(null);
        setIgnoredRecommendation(null);
      }
    }

    return () => {
      abortController.abort();
    };
  }, [
    currentMoveIndex,
    isTeacherMode,
    humanPlayerColor,
    gameMode,
    moveCoordinates,
    setIgnoredRecommendation,
    setTeacherCritique,
    fetchCritique,
  ]);

  if (!isTeacherMode || isGameOver) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm w-full flex flex-col mb-4 overflow-hidden text-center">
      <div className="flex justify-center items-center mb-3 shrink-0 relative">
        <h2 className="font-bold text-gray-700 flex items-center gap-2">
          <img
            src="/igo_logo.png"
            alt="iGo"
            className="w-6 h-6 object-contain"
          />
          {t('teacherMode')}
        </h2>
        <div className="text-[10px] text-blue-600 font-semibold animate-pulse absolute right-0">
          {t('teacherModeActive')}
        </div>
      </div>
      <div className="space-y-3 flex-1">
        {teacherCritique && (
          <div className="bg-rose-50 border border-rose-100 text-rose-900 p-3 rounded-lg shadow-inner relative overflow-hidden">
            <h3 className="font-bold text-[10px] flex items-center gap-1 mb-2 text-rose-700 uppercase tracking-wider">
              <span className="mr-1">⚠️</span> {t('teacherAnalysis').replace('⚠️ ', '')}
            </h3>

            <div className="flex gap-2 mb-3">
              <div className="flex-1 bg-white/50 rounded p-1.5 border border-rose-200/50">
                <div className="text-[8px] text-rose-400 font-bold uppercase">
                  {t('myMove')}
                </div>
                <div className="text-xs font-black text-rose-900">
                  {moveCoordinates[currentMoveIndex]
                    ? coordsToGtp(
                      moveCoordinates[currentMoveIndex]!.x,
                      moveCoordinates[currentMoveIndex]!.y,
                      boardSize
                    )
                    : t('pass')}
                </div>
              </div>
              <div className="flex-1 bg-blue-50/50 rounded p-1.5 border border-blue-200/50">
                <div className="text-[8px] text-blue-400 font-bold uppercase">
                  {t('recommendedMove')}
                </div>
                <div className="text-xs font-black text-blue-900">
                  {ignoredRecommendation && ignoredRecommendation.length > 0
                    ? ignoredRecommendation
                      .map((r) => coordsToGtp(r.x, r.y, boardSize))
                      .join(", ")
                    : "-"}
                </div>
              </div>
            </div>

            <p className="text-xs leading-relaxed italic border-t border-rose-100 pt-2 mt-1">
              "{teacherCritique}"
            </p>
          </div>
        )}

        <div className="text-xs bg-blue-50 text-blue-900 p-3 rounded-lg border border-blue-100 h-full">
          {isFetchingHint ? (
            <div className="flex items-center gap-2 h-full">
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              {t('analyzing')}
            </div>
          ) : (
            <div className="leading-relaxed">
              {aiData?.recommendations && aiData.recommendations.length > 0 ? (
                <>
                  <span className="font-bold text-blue-800 block mb-1">
                    {t('recommendationPrefix')}{aiData.recommendations.map((r: { gtpMove: string }) => r.gtpMove).join(", ")}
                  </span>
                  {aiData.recommendations[0].explanation}
                </>
              ) : (
                <span className="opacity-70 italic h-full flex items-center">
                  {t('analysisReady')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherAdviceWidget;
