import React, { useEffect, useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore, getPathToNode } from "@/entities/match/model/store";
import { HistoryNode } from "@/entities/match/model/types";
import { useQuery } from "@tanstack/react-query";
import { fetchAIHint, API_BASE_URL, fetchWithAuth } from "@/shared/api/gameApi";
import { getPlayerForMove } from "@/shared/lib/goUtils";
import { useShallow } from "zustand/react/shallow";

const coordsToGtp = (x: number, y: number, boardSize: number) =>
  "ABCDEFGHJKLMNOPQRST"[x] + (boardSize - y);

const TeacherAdviceWidget = ({
  sideBySide = false,
}: {
  sideBySide?: boolean;
}) => {
  const { t } = useTranslation();

  // perf: useShallow prevents re-renders when unrelated store fields change
  const {
    board,
    currentPlayer,
    isTeacherMode,
    currentNode,
    gameMode,
    aiDifficulty,
    humanPlayerColor,
    isGameOver,
    isReviewMode,
    teacherVisits,
    ignoredRecommendation,
    teacherCritique,
    updateWinRate,
    language,
    boardSize,
    handicap,
    gameTree,
  } = useGameStore(
    useShallow((s) => ({
      board: s.board,
      currentPlayer: s.currentPlayer,
      isTeacherMode: s.isTeacherMode,
      currentNode: s.currentNode,
      gameMode: s.gameMode,
      aiDifficulty: s.aiDifficulty,
      humanPlayerColor: s.humanPlayerColor,
      isGameOver: s.isGameOver,
      isReviewMode: s.isReviewMode,
      teacherVisits: s.teacherVisits,
      ignoredRecommendation: s.ignoredRecommendation,
      teacherCritique: s.teacherCritique,
      updateWinRate: s.updateWinRate,
      language: s.language,
      boardSize: s.boardSize,
      handicap: s.handicap,
      gameTree: s.gameTree,
    })),
  );

  const [lastCritiquedMove, setLastCritiquedMove] = useState<string | null>(
    null,
  );
  const recommendationsByNodeId = useRef<
    Record<
      string,
      {
        x: number;
        y: number;
        winRate?: number;
        visits?: number;
        gtpMove: string;
        explanation: string;
      }[]
    >
  >({});
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
      const path = getPathToNode(gameTree, currentNode.id) || [currentNode];
      const moves: ({ x: number; y: number } | null)[] = [];
      for (let i = 1; i < path.length; i++) {
        const node = path[i];
        moves.push(
          node.x !== null && node.y !== null ? { x: node.x, y: node.y } : null,
        );
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
      (gameMode === "PvP" ||
        isReviewMode ||
        currentPlayer === humanPlayerColor),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Update win rate in store when AI data is received
  useEffect(() => {
    if (
      aiData &&
      typeof aiData.winRate === "number" &&
      aiData.nodeId === currentNode.id
    ) {
      const blackWinRate =
        currentPlayer === "BLACK" ? aiData.winRate : 100 - aiData.winRate;
      if (currentNode.winRate !== blackWinRate) {
        updateWinRate(currentNode.id, blackWinRate);
      }
    }
  }, [
    aiData,
    currentNode.id,
    currentNode.winRate,
    updateWinRate,
    currentPlayer,
  ]);

  // Track the recommendation to contrast it later
  useEffect(() => {
    if (aiData?.recommendations && aiData.nodeId === currentNode.id) {
      const cache = recommendationsByNodeId.current;
      cache[currentNode.id] = aiData.recommendations;
      const keys = Object.keys(cache);
      if (keys.length > 50) {
        keys.slice(0, keys.length - 50).forEach((k) => delete cache[k]);
      }
    }
  }, [aiData, currentNode.id]);

  const fetchCritique = useCallback(
    async (
      userMove: { x: number; y: number },
      bestMoves: { x: number; y: number }[],
      targetNode: HistoryNode,
      signal: AbortSignal,
    ) => {
      if (fetchingCritiqueForNodeId.current === targetNode.id) return;
      fetchingCritiqueForNodeId.current = targetNode.id;

      try {
        const path = getPathToNode(
          useGameStore.getState().gameTree,
          targetNode.id,
        );
        if (!path || path.length < 2) return;

        const parentNode = path[path.length - 2];
        const moves: ({ x: number; y: number } | null)[] = [];
        for (let i = 1; i < path.length - 1; i++) {
          const node = path[i];
          moves.push(
            node.x !== null && node.y !== null
              ? { x: node.x, y: node.y }
              : null,
          );
        }

        const response = await fetchWithAuth(`${API_BASE_URL}/ai/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            board: parentNode.board,
            currentPlayer: getPlayerForMove(parentNode.moveIndex, handicap),
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
        });
        const data = await response.json();

        if (
          useGameStore.getState().currentNode.id === targetNode.id &&
          data.critique
        ) {
          useGameStore.setState({
            teacherCritique: data.critique,
            ignoredRecommendation: bestMoves,
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
    [aiDifficulty, teacherVisits, language, boardSize, handicap],
  );

  // Listen for move changes to determine if we should show a critique
  useEffect(() => {
    const currentState = useGameStore.getState();

    if (!isTeacherMode || currentNode.id === "root") {
      if (
        currentState.teacherCritique !== null ||
        currentState.ignoredRecommendation !== null
      ) {
        useGameStore.setState({
          teacherCritique: null,
          ignoredRecommendation: null,
        });
      }
      setLastCritiquedMove(null);
      return;
    }

    const lastMove =
      currentNode.x !== null && currentNode.y !== null
        ? { x: currentNode.x, y: currentNode.y }
        : null;

    const path = getPathToNode(currentState.gameTree, currentNode.id);
    const parentNode = path && path.length > 1 ? path[path.length - 2] : null;
    const rec = parentNode
      ? recommendationsByNodeId.current[parentNode.id]
      : null;

    const moveColor = getPlayerForMove(currentNode.moveIndex - 1, handicap);

    if (gameMode === "PvAI" && moveColor !== humanPlayerColor) {
      return;
    }

    if (
      currentState.teacherCritique !== null ||
      currentState.ignoredRecommendation !== null
    ) {
      useGameStore.setState({
        teacherCritique: null,
        ignoredRecommendation: null,
      });
    }
    setLastCritiquedMove(null);

    const abortController = new AbortController();

    if (lastMove && rec && rec.length > 0) {
      const isFollowed = rec.some(
        (r) => r.x === lastMove.x && r.y === lastMove.y,
      );
      if (!isFollowed) {
        fetchCritique(lastMove, rec, currentNode, abortController.signal);
      }
    }

    return () => {
      abortController.abort();
    };
  }, [
    currentNode,
    isTeacherMode,
    humanPlayerColor,
    gameMode,
    fetchCritique,
    handicap,
  ]);

  if (!isTeacherMode || isGameOver) return null;

  const containerBaseClass = `bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg flex flex-col overflow-hidden transition-all duration-500 ease-in-out z-20`;

  // Desktop Side-by-Side Mode
  if (sideBySide) {
    return (
      <div
        className={`${containerBaseClass} w-72 sticky top-4 mt-6 shrink-0 -ml-3.5 p-4 text-center h-auto`}
      >
        <div className="flex justify-center items-center mb-3 shrink-0 text-center">
          <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <img
              src="/igo_logo.png"
              alt="iGo"
              className="w-6 h-6 object-contain rounded-full"
            />
            {t("teacherMode")}
          </h2>
        </div>

        <div className="space-y-3 flex-1 flex flex-col">
          {teacherCritique && (
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 text-rose-900 dark:text-rose-200 p-3 rounded-lg shadow-inner relative overflow-hidden animate-fade-in text-center transition-all duration-500 max-h-[300px]">
              <h3 className="font-bold text-[10px] flex items-center justify-center gap-1 mb-2 text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                <span className="mr-1">⚠️</span>{" "}
                {t("teacherAnalysis").replace("⚠️ ", "")}
              </h3>

              <div className="flex gap-2 mb-3">
                <div className="flex-1 bg-white/50 dark:bg-gray-700/50 rounded p-1.5 border border-rose-200/50 dark:border-rose-700/50">
                  <div className="text-[8px] text-rose-400 font-bold uppercase">
                    {t("myMove")}
                  </div>
                  <div className="text-xs font-black text-rose-900 dark:text-rose-300">
                    {lastCritiquedMove || "-"}
                  </div>
                </div>
                <div className="flex-1 bg-blue-50/50 dark:bg-blue-900/30 rounded p-1.5 border border-blue-200/50 dark:border-blue-700/50">
                  <div className="text-[8px] text-blue-400 font-bold uppercase">
                    {t("recommendedMove")}
                  </div>
                  <div className="text-xs font-black text-blue-900 dark:text-blue-300">
                    {ignoredRecommendation && ignoredRecommendation.length > 0
                      ? ignoredRecommendation
                          .map((r) => coordsToGtp(r.x, r.y, boardSize))
                          .join(", ")
                      : "-"}
                  </div>
                </div>
              </div>

              <p className="text-xs leading-relaxed italic border-t border-rose-100 dark:border-rose-800 pt-2 mt-1">
                "{teacherCritique}"
              </p>
            </div>
          )}

          <div className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 p-3 rounded-lg border border-blue-100 dark:border-blue-800 flex-1 min-h-[80px] flex flex-col justify-center text-center transition-all duration-500">
            {isFetchingHint ? (
              <div className="flex flex-col items-center gap-2 w-full animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-medium">{t("analyzing")}</span>
                </div>
                <div className="w-full space-y-2 mt-2">
                  <div className="h-2 bg-blue-200/50 dark:bg-blue-800/50 rounded w-full" />
                  <div className="h-2 bg-blue-200/50 dark:bg-blue-800/50 rounded w-2/3" />
                </div>
              </div>
            ) : (
              <div className="leading-relaxed animate-fade-in">
                {aiData?.recommendations &&
                aiData.recommendations.length > 0 ? (
                  <>
                    <span className="font-bold text-blue-800 dark:text-blue-300 block mb-1">
                      {t("recommendationPrefix")}
                      {aiData.recommendations
                        .map((r: { gtpMove: string }) => r.gtpMove)
                        .join(", ")}
                    </span>
                    {aiData.recommendations[0].explanation}
                  </>
                ) : (
                  <span className="opacity-70 italic h-full flex items-center justify-center">
                    {t("analysisReady")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Mobile Mode - Positioned naturally below board instead of fixed overlay
  return (
    <div
      className={`${containerBaseClass} w-full max-w-lg mb-6 animate-fade-in transition-all duration-500 ease-in-out`}
    >
      <div className="flex items-center justify-between px-4 h-10 shrink-0 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/20">
        <div className="flex items-center gap-2">
          <img
            src="/igo_logo.png"
            alt="iGo"
            className={`w-4 h-4 object-contain rounded-full ${isFetchingHint ? "animate-pulse" : ""}`}
          />
          <span className="text-[11px] font-extrabold text-gray-600 dark:text-gray-300 uppercase tracking-tight">
            {t("teacherMode")}
          </span>
          {isFetchingHint && (
            <span className="flex items-center gap-1.5 ml-2 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
              <div className="w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              {t("analyzing")}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="space-y-3">
          {teacherCritique && (
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 p-3 rounded-lg shadow-inner animate-fade-in text-center transition-all duration-500 max-h-[300px] overflow-hidden">
              <div className="flex gap-2 mb-2">
                <div className="flex-1 bg-white/50 dark:bg-gray-700/50 rounded px-2 py-1 border border-rose-200/50">
                  <span className="text-[8px] text-rose-400 block font-bold uppercase">
                    {t("myMove")}
                  </span>
                  <span className="text-xs font-black text-rose-900 dark:text-rose-300">
                    {lastCritiquedMove || "-"}
                  </span>
                </div>
                <div className="flex-1 bg-blue-50/50 dark:bg-blue-900/30 rounded px-2 py-1 border border-blue-200/50">
                  <span className="text-[8px] text-blue-400 block font-bold uppercase">
                    {t("recommendedMove")}
                  </span>
                  <span className="text-xs font-black text-blue-900 dark:text-blue-300">
                    {ignoredRecommendation && ignoredRecommendation.length > 0
                      ? ignoredRecommendation
                          .map((r) => coordsToGtp(r.x, r.y, boardSize))
                          .join(", ")
                      : "-"}
                  </span>
                </div>
              </div>
              <p className="text-xs leading-relaxed italic text-rose-900 dark:text-rose-200">
                "{teacherCritique}"
              </p>
            </div>
          )}

          <div className="text-xs bg-blue-50/50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 p-3 rounded-lg border border-blue-100 dark:border-blue-800 min-h-[60px] flex flex-col justify-center text-center transition-all duration-500">
            {isFetchingHint && !teacherCritique ? (
              <div className="space-y-2 py-1 animate-pulse">
                <div className="h-2 bg-blue-200/50 dark:bg-blue-800/50 rounded w-full" />
                <div className="h-2 bg-blue-200/50 dark:bg-blue-800/50 rounded w-2/3" />
              </div>
            ) : (
              <div className="leading-relaxed animate-fade-in text-center">
                {aiData?.recommendations &&
                aiData.recommendations.length > 0 ? (
                  <>
                    <span className="font-bold text-blue-800 dark:text-blue-300 block mb-1">
                      {t("recommendationPrefix")}
                      {aiData.recommendations
                        .map((r: { gtpMove: string }) => r.gtpMove)
                        .join(", ")}
                    </span>
                    {aiData.recommendations[0].explanation}
                  </>
                ) : (
                  <span className="opacity-70 italic">
                    {t("analysisReady")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(TeacherAdviceWidget);
