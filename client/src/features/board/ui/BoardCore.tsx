import React, { useMemo, useCallback } from "react";
import { useGameStore, getPathToNode } from "@/entities/match/model/store";
import {
  useOnlineStore,
  getOnlineMyColor,
} from "@/entities/online/model/store";
import { useQuery } from "@tanstack/react-query";
import { fetchAIHint } from "@/shared/api/gameApi";
import { playStoneSound } from "@/shared/lib/sound";
import { buildMoveHistory } from "@/shared/lib/goUtils";
import { useShallow } from "zustand/react/shallow";
import { useRenderProfile } from "@/shared/lib/useRenderProfile";

const BASE_CELL_SIZE = 30; // 픽셀 단위 격자 크기
const BASE_MARGIN = 20; // 바둑판 여백

// 화점 위치 계산
const getStarPoints = (size: number) => {
  if (size < 9) return [];
  const edge = size >= 13 ? 3 : 2;
  const mid = Math.floor(size / 2);
  const far = size - 1 - edge;
  const points = [
    [edge, edge],
    [far, edge],
    [edge, far],
    [far, far],
  ];
  if (size >= 13) {
    points.push([mid, edge], [edge, mid], [far, mid], [mid, far], [mid, mid]);
  } else if (size % 2 === 1) {
    points.push([mid, mid]);
  }
  return points;
};

const BoardCore: React.FC = () => {
  useRenderProfile("BoardCore");

  // perf: useShallow prevents re-renders when unrelated store fields change
  const {
    boardSize,
    board,
    placeStone,
    currentNode,
    isTeacherMode,
    currentPlayer,
    isGameOver,
    gameMode,
    humanPlayerColor,
    isReviewMode,
    showDeadStones,
    boardScale,
    soundEnabled,
    soundVolume,
    ignoredRecommendation,
    aiDifficulty,
    teacherVisits,
    language,
    handicap,
    deadStones,
    goToNextMove,
    gameTree,
  } = useGameStore(
    useShallow((s) => ({
      boardSize: s.boardSize,
      board: s.board,
      placeStone: s.placeStone,
      currentNode: s.currentNode,
      isTeacherMode: s.isTeacherMode,
      currentPlayer: s.currentPlayer,
      isGameOver: s.isGameOver,
      gameMode: s.gameMode,
      humanPlayerColor: s.humanPlayerColor,
      isReviewMode: s.isReviewMode,
      showDeadStones: s.showDeadStones,
      boardScale: s.boardScale,
      soundEnabled: s.soundEnabled,
      soundVolume: s.soundVolume,
      ignoredRecommendation: s.ignoredRecommendation,
      aiDifficulty: s.aiDifficulty,
      teacherVisits: s.teacherVisits,
      language: s.language,
      handicap: s.handicap,
      deadStones: s.deadStones,
      goToNextMove: s.goToNextMove,
      gameTree: s.gameTree,
    })),
  );

  const CELL_SIZE = BASE_CELL_SIZE * boardScale;
  const MARGIN = BASE_MARGIN * boardScale;
  const BOARD_PIXEL_SIZE = CELL_SIZE * (boardSize - 1) + MARGIN * 2;

  const handleBoardClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // In review mode, allow clicking freely to explore variations.
      if (!isReviewMode) {
        // In PvAI mode, prevent clicking if it's AI's turn.
        if (gameMode === "PvAI" && currentPlayer !== humanPlayerColor) return;

        // In Online mode, prevent clicking if it's not my turn.
        if (gameMode === "Online") {
          const myColor = getOnlineMyColor();
          if (!myColor || currentPlayer !== myColor) return;
        }
      }

      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      // Convert screen coordinates to SVG coordinates (accounts for CSS scaling)
      const scaleX = BOARD_PIXEL_SIZE / rect.width;
      const scaleY = BOARD_PIXEL_SIZE / rect.height;
      const xPixel = (e.clientX - rect.left) * scaleX - MARGIN;
      const yPixel = (e.clientY - rect.top) * scaleY - MARGIN;

      const x = Math.round(xPixel / CELL_SIZE);
      const y = Math.round(yPixel / CELL_SIZE);

      if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
        // In online mode, send move via WebSocket (server validates and broadcasts)
        if (gameMode === "Online" && !isReviewMode) {
          useOnlineStore.getState().sendMove(x, y);
        }
        placeStone(x, y);
        playStoneSound(soundEnabled, soundVolume);
      }
    },
    [
      isReviewMode,
      gameMode,
      currentPlayer,
      humanPlayerColor,
      MARGIN,
      CELL_SIZE,
      BOARD_PIXEL_SIZE,
      boardSize,
      placeStone,
      soundEnabled,
      soundVolume,
    ],
  );

  const { data: aiData } = useQuery({
    queryKey: [
      "aiHint",
      currentNode.id, // Only depend on ID
      currentPlayer,
      aiDifficulty,
      teacherVisits,
      language,
      boardSize,
      handicap,
    ],
    queryFn: ({ signal }) => {
      // refactor: reuse shared buildMoveHistory instead of inline logic
      const path = getPathToNode(gameTree, currentNode.id) || [currentNode];
      const moves = buildMoveHistory(path);

      return fetchAIHint(
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
    },
    enabled:
      isTeacherMode &&
      !isGameOver &&
      gameMode !== "Online" &&
      (gameMode === "PvP" || currentPlayer === humanPlayerColor),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const isFinalMove = currentNode.children.length === 0;
  const shouldShowDeadStones =
    (isGameOver || isReviewMode) && showDeadStones && isFinalMove;

  // Memoized Renderers for CPU optimization
  const gridLines = useMemo(() => {
    return Array.from({ length: boardSize }).map((_, i) => (
      <React.Fragment key={`lines-${i}`}>
        <line
          x1={MARGIN}
          y1={MARGIN + i * CELL_SIZE}
          x2={BOARD_PIXEL_SIZE - MARGIN}
          y2={MARGIN + i * CELL_SIZE}
          stroke="var(--board-line)"
          strokeWidth="1"
        />
        <line
          x1={MARGIN + i * CELL_SIZE}
          y1={MARGIN}
          x2={MARGIN + i * CELL_SIZE}
          y2={BOARD_PIXEL_SIZE - MARGIN}
          stroke="var(--board-line)"
          strokeWidth="1"
        />
      </React.Fragment>
    ));
  }, [boardSize, MARGIN, CELL_SIZE, BOARD_PIXEL_SIZE]);

  const starPointsElements = useMemo(() => {
    return getStarPoints(boardSize).map(([x, y]) => (
      <circle
        key={`star-${x}-${y}`}
        cx={MARGIN + x * CELL_SIZE}
        cy={MARGIN + y * CELL_SIZE}
        r="3"
        fill="var(--board-line)"
      />
    ));
  }, [boardSize, MARGIN, CELL_SIZE]);

  const renderedStones = useMemo(() => {
    return board.map((row, y) =>
      row.map((stone, x) => {
        if (!stone) return null;
        const isLastMove = currentNode.x === x && currentNode.y === y;
        const isDead =
          shouldShowDeadStones &&
          deadStones?.some((ds) => ds.x === x && ds.y === y);

        return (
          <g
            key={`stone-group-${x}-${y}`}
            className={isDead ? "opacity-40" : ""}
          >
            <circle
              cx={MARGIN + x * CELL_SIZE}
              cy={MARGIN + y * CELL_SIZE}
              r={CELL_SIZE / 2.2}
              fill={stone === "BLACK" ? "#000000" : "#ffffff"}
              stroke={stone === "WHITE" ? "#cccccc" : "#333333"}
              strokeWidth="1"
              className="drop-shadow-md transition-all duration-200"
            />
            {isLastMove && !isDead && (
              <circle
                cx={MARGIN + x * CELL_SIZE}
                cy={MARGIN + y * CELL_SIZE}
                r={CELL_SIZE / 6}
                fill={
                  stone === "BLACK"
                    ? "rgba(255,255,255,0.7)"
                    : "rgba(0,0,0,0.7)"
                }
              />
            )}
          </g>
        );
      }),
    );
  }, [
    board,
    MARGIN,
    CELL_SIZE,
    currentNode.x,
    currentNode.y,
    shouldShowDeadStones,
    deadStones,
  ]);

  return (
    <svg
      viewBox={`0 0 ${BOARD_PIXEL_SIZE} ${BOARD_PIXEL_SIZE}`}
      width={BOARD_PIXEL_SIZE}
      height={BOARD_PIXEL_SIZE}
      className="cursor-pointer select-none max-w-full h-auto"
      style={{ touchAction: "manipulation" }}
      onClick={handleBoardClick}
      role="grid"
      aria-label="Go Board"
    >
      {/* 격자 선 그리기 */}
      {gridLines}

      {/* 화점 그리기 */}
      {starPointsElements}

      {/* Variation Markers (A, B, C...) */}
      {isReviewMode &&
        currentNode.children.map((child, idx) => {
          if (child.x === null || child.y === null) return null;
          const label = String.fromCharCode(65 + idx); // A, B, C...
          return (
            <g
              key={`var-${child.id}`}
              onClick={(e) => {
                e.stopPropagation();
                goToNextMove(idx);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  goToNextMove(idx);
                }
              }}
              className="cursor-pointer group"
              role="button"
              tabIndex={0}
              aria-label={`Variation ${label}`}
            >
              <rect
                x={MARGIN + child.x * CELL_SIZE - CELL_SIZE / 3}
                y={MARGIN + child.y * CELL_SIZE - CELL_SIZE / 3}
                width={CELL_SIZE / 1.5}
                height={CELL_SIZE / 1.5}
                rx="2"
                fill="rgba(59, 130, 246, 0.8)"
                className="group-hover:fill-blue-600 transition-colors"
              />
              <text
                x={MARGIN + child.x * CELL_SIZE}
                y={MARGIN + child.y * CELL_SIZE}
                dominantBaseline="central"
                textAnchor="middle"
                fill="white"
                fontSize={CELL_SIZE / 2}
                fontWeight="bold"
                style={{ pointerEvents: "none" }}
              >
                {label}
              </text>
            </g>
          );
        })}

      {/* AI 힌트 하이라이트 */}
      {isTeacherMode &&
        aiData?.recommendations &&
        aiData.recommendations.map(
          (rec: { x: number; y: number }, idx: number) => {
            const opacity = idx === 0 ? 0.4 : idx === 1 ? 0.25 : 0.15;
            const radius = idx === 0 ? CELL_SIZE / 1.5 : CELL_SIZE / 1.8;
            return (
              <circle
                key={`hint-${rec.x}-${rec.y}`}
                cx={MARGIN + rec.x * CELL_SIZE}
                cy={MARGIN + rec.y * CELL_SIZE}
                r={radius}
                fill={`rgba(59, 130, 246, ${opacity})`}
                className="animate-pulse"
                style={{ pointerEvents: "none" }}
              />
            );
          },
        )}

      {/* 선생님의 지시 흔적 */}
      {isTeacherMode &&
        ignoredRecommendation &&
        ignoredRecommendation.map(
          (rec: { x: number; y: number }, idx: number) => {
            const radius = idx === 0 ? CELL_SIZE / 1.5 : CELL_SIZE / 1.8;
            const strokeWidth = idx === 0 ? "4" : idx === 1 ? "2.5" : "1.5";
            const strokeOpacity = idx === 0 ? 0.9 : idx === 1 ? 0.6 : 0.4;
            return (
              <circle
                key={`ignored-${rec.x}-${rec.y}`}
                cx={MARGIN + rec.x * CELL_SIZE}
                cy={MARGIN + rec.y * CELL_SIZE}
                r={radius}
                fill="transparent"
                stroke={`rgba(34, 197, 94, ${strokeOpacity})`}
                strokeWidth={strokeWidth}
                strokeDasharray="4 2"
                className="animate-pulse"
                style={{ pointerEvents: "none" }}
              />
            );
          },
        )}

      {/* 돌 그리기 */}
      {renderedStones}

      {/* 사석 표시 레이어 (최상단) */}
      {shouldShowDeadStones &&
        deadStones &&
        deadStones.map((ds, idx) => {
          const stone = board[ds.y] ? board[ds.y][ds.x] : null;
          if (!stone) return null;
          return (
            <g
              key={`dead-mark-${idx}`}
              stroke="#ff0000"
              strokeWidth="3"
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            >
              <line
                x1={MARGIN + ds.x * CELL_SIZE - CELL_SIZE / 3.5}
                y1={MARGIN + ds.y * CELL_SIZE - CELL_SIZE / 3.5}
                x2={MARGIN + ds.x * CELL_SIZE + CELL_SIZE / 3.5}
                y2={MARGIN + ds.y * CELL_SIZE + CELL_SIZE / 3.5}
              />
              <line
                x1={MARGIN + ds.x * CELL_SIZE + CELL_SIZE / 3.5}
                y1={MARGIN + ds.y * CELL_SIZE - CELL_SIZE / 3.5}
                x2={MARGIN + ds.x * CELL_SIZE - CELL_SIZE / 3.5}
                y2={MARGIN + ds.y * CELL_SIZE + CELL_SIZE / 3.5}
              />
            </g>
          );
        })}
    </svg>
  );
};

export default React.memo(BoardCore);
