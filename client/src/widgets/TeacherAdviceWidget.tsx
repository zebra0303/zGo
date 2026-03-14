import { useEffect, useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore, getPathToNode } from "@/entities/match/model/store";
import { useQuery } from "@tanstack/react-query";
import { fetchAIHint, API_BASE_URL } from "@/shared/api/gameApi";

const coordsToGtp = (x: number, y: number, boardSize: number) =>
  "ABCDEFGHJKLMNOPQRST"[x] + (boardSize - y);

const TeacherAdviceWidget = () => {
  const { t } = useTranslation();
  const {
    board,
    currentPlayer,
    isTeacherMode,
    currentNode,
    gameMode,
    aiDifficulty,
    humanPlayerColor,
    isGameOver,
    teacherVisits,
    ignoredRecommendation,
    teacherCritique,
    updateWinRate,
    language,
    boardSize,
    handicap,
    gameTree,
  } = useGameStore();

  const [lastCritiquedMove, setLastCritiquedMove] = useState<string | null>(null);
  const recommendationsByNodeId = useRef<Record<string, { x: number; y: number; winRate?: number; visits?: number; gtpMove: string; explanation: string }[]>>({});
  const fetchingCritiqueForNodeId = useRef<string | null>(null);

  // API 호출을 통한 힌트 요청
  const { data: aiData, isFetching: isFetchingHint } = useQuery({
    queryKey: [
      "aiHint",
      currentNode.id,
      currentPlayer,
      aiDifficulty,
      teacherVisits,
      language,
      boardSize,
      handicap,
    ],
    queryFn: async ({ signal }) => {
      // Get history ONLY inside queryFn to keep queryKey stable
      const path = getPathToNode(gameTree, currentNode.id) || [currentNode];
      const moves: ({ x: number; y: number } | null)[] = [];
      for (let i = 1; i < path.length; i++) {
        const node = path[i];
        moves.push(node.x !== null && node.y !== null ? { x: node.x, y: node.y } : null);
      }
      
      const data = await fetchAIHint(
        board,
        currentPlayer,
        aiDifficulty,
        teacherVisits,
        moves,
        signal,
        language,
        boardSize,
        handicap,
      );
      return { ...data, nodeId: currentNode.id };
    },
    enabled:
      isTeacherMode &&
      !isGameOver &&
      (gameMode === "PvP" || currentPlayer === humanPlayerColor),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Update win rate in store when AI data is received
  useEffect(() => {
    if (aiData && typeof aiData.winRate === "number" && aiData.nodeId === currentNode.id) {
      const blackWinRate =
        currentPlayer === "BLACK" ? aiData.winRate : 100 - aiData.winRate;
      console.log(`[TeacherAdvice] Fetched winrate for node ${currentNode.id}: aiData.winRate=${aiData.winRate}, blackWinRate=${blackWinRate}`);
      // Only update if current store winRate is different to avoid redundant renders
      if (currentNode.winRate !== blackWinRate) {
        console.log(`[TeacherAdvice] Updating store winRate from ${currentNode.winRate} to ${blackWinRate}`);
        updateWinRate(currentNode.id, blackWinRate);
      }
    }
  }, [aiData, currentNode.id, currentNode.winRate, updateWinRate, currentPlayer]);

  // Track the recommendation to contrast it later
  useEffect(() => {
    if (aiData?.recommendations && aiData.nodeId === currentNode.id) {
      recommendationsByNodeId.current[currentNode.id] = aiData.recommendations;
    }
  }, [aiData, currentNode.id]);

  const fetchCritique = useCallback(
    async (
      userMove: { x: number; y: number },
      bestMoves: { x: number; y: number }[],
      targetNode: any,
      signal: AbortSignal,
    ) => {
      if (fetchingCritiqueForNodeId.current === targetNode.id) return;
      fetchingCritiqueForNodeId.current = targetNode.id;

      try {
        const path = getPathToNode(useGameStore.getState().gameTree, targetNode.id);
        if (!path || path.length < 2) return;
        
        const parentNode = path[path.length - 2];
        const moves: ({ x: number; y: number } | null)[] = [];
        for (let i = 1; i < path.length - 1; i++) {
          const node = path[i];
          moves.push(node.x !== null && node.y !== null ? { x: node.x, y: node.y } : null);
        }

        const response = await fetch(
          `${API_BASE_URL}/ai/move`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              board: parentNode.board,
              currentPlayer: handicap > 0
                ? (parentNode.moveIndex % 2 === 0 ? "WHITE" : "BLACK")
                : (parentNode.moveIndex % 2 === 0 ? "BLACK" : "WHITE"),
              isHintRequest: true,
              aiDifficulty,
              teacherVisits,
              lastUserMove: userMove,
              lastRecommendations: bestMoves,
              moves: moves,
              language,
              boardSize,
              handicap,
            }),
            signal,
          },
        );
        const data = await response.json();

        const currentStoreState = useGameStore.getState();
        if (currentStoreState.currentNode.id === targetNode.id && data.critique) {
          useGameStore.setState({ 
            teacherCritique: data.critique, 
            ignoredRecommendation: bestMoves 
          });
          setLastCritiquedMove(coordsToGtp(userMove.x, userMove.y, boardSize));
        }
      } catch (err) {
        const e = err as Error;
        if (e?.name !== "AbortError" && !e?.message?.includes("abort")) {
          console.error("Critique fetch failed", e);
        }
      } finally {
        if (fetchingCritiqueForNodeId.current === targetNode.id) {
          fetchingCritiqueForNodeId.current = null;
        }
      }
    },
    [
      aiDifficulty,
      teacherVisits,
      language,
      boardSize,
      handicap,
    ],
  );

  // Listen for move changes to determine if we should show a critique
  useEffect(() => {
    const currentState = useGameStore.getState();
    
    if (!isTeacherMode || currentNode.id === "root") {
      if (currentState.teacherCritique !== null || currentState.ignoredRecommendation !== null) {
        useGameStore.setState({ teacherCritique: null, ignoredRecommendation: null });
      }
      setLastCritiquedMove(null);
      return;
    }

    const lastMove = (currentNode.x !== null && currentNode.y !== null) ? { x: currentNode.x, y: currentNode.y } : null;
    
    const path = getPathToNode(currentState.gameTree, currentNode.id);
    const parentNode = path && path.length > 1 ? path[path.length - 2] : null;
    const rec = parentNode ? recommendationsByNodeId.current[parentNode.id] : null;

    const moveColor = handicap > 0
      ? (currentNode.moveIndex % 2 === 1 ? "WHITE" : "BLACK")
      : (currentNode.moveIndex % 2 === 1 ? "BLACK" : "WHITE");

    if (gameMode === "PvAI" && moveColor !== humanPlayerColor) {
      return;
    }

    if (currentState.teacherCritique !== null || currentState.ignoredRecommendation !== null) {
      useGameStore.setState({ teacherCritique: null, ignoredRecommendation: null });
    }
    setLastCritiquedMove(null);

    const abortController = new AbortController();

    if (lastMove && rec && rec.length > 0) {
      const isFollowed = rec.some(r => r.x === lastMove.x && r.y === lastMove.y);
      if (!isFollowed) {
        fetchCritique(
          lastMove,
          rec,
          currentNode,
          abortController.signal,
        );
      }
    }

    return () => {
      abortController.abort();
    };
  }, [
    currentNode.id,
    isTeacherMode,
    humanPlayerColor,
    gameMode,
    fetchCritique,
    handicap,
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
                  {lastCritiquedMove || "-"}
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
