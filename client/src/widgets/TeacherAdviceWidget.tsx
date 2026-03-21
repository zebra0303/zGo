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
      // Get history ONLY inside queryFn to keep queryKey stable
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
      // perf: only update if winRate actually changed to avoid redundant renders
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

  // Track the recommendation to contrast it later (cap at 50 entries)
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

        const currentStoreState = useGameStore.getState();
        if (
          currentStoreState.currentNode.id === targetNode.id &&
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

    // refactor: derive who placed this stone from parent's turn
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm flex flex-col mb-4 overflow-hidden text-center ${
        sideBySide ? "w-72 sticky top-4 mt-6 shrink-0 -ml-3.5" : "w-full"
      }`}
    >
      <div className="flex justify-center items-center mb-3 shrink-0">
        <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <img
            src="/igo_logo.png"
            alt="iGo"
            className="w-6 h-6 object-contain rounded-full"
          />
          {t("teacherMode")}
        </h2>
      </div>
      <div className="space-y-3 flex-1">
        {teacherCritique && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 text-rose-900 dark:text-rose-200 p-3 rounded-lg shadow-inner relative overflow-hidden">
            <h3 className="font-bold text-[10px] flex items-center gap-1 mb-2 text-rose-700 dark:text-rose-300 uppercase tracking-wider">
              <span className="mr-1">⚠️</span>{" "}
              {t("teacherAnalysis").replace("⚠️ ", "")}
            </h3>

            <div className="flex gap-2 mb-3">
              <div className="flex-1 bg-white/50 dark:bg-gray-700/50 rounded p-1.5 border border-rose-200/50 dark:border-rose-700/50">
                <div className="text-[8px] text-rose-400 dark:text-rose-400 font-bold uppercase">
                  {t("myMove")}
                </div>
                <div className="text-xs font-black text-rose-900 dark:text-rose-300">
                  {lastCritiquedMove || "-"}
                </div>
              </div>
              <div className="flex-1 bg-blue-50/50 dark:bg-blue-900/30 rounded p-1.5 border border-blue-200/50 dark:border-blue-700/50">
                <div className="text-[8px] text-blue-400 dark:text-blue-400 font-bold uppercase">
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

        <div className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 p-3 rounded-lg border border-blue-100 dark:border-blue-800 h-full">
          {isFetchingHint ? (
            <div className="flex items-center gap-2 h-full">
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              {t("analyzing")}
            </div>
          ) : (
            <div className="leading-relaxed">
              {aiData?.recommendations && aiData.recommendations.length > 0 ? (
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
                <span className="opacity-70 italic h-full flex items-center">
                  {t("analysisReady")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(TeacherAdviceWidget);
