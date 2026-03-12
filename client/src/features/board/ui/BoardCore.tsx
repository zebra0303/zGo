import React from "react";
import { useGameStore } from "@/entities/match/model/store";
import { useQuery } from "@tanstack/react-query";
import { fetchAIHint } from "@/shared/api/gameApi";
import { playStoneSound } from "@/shared/lib/sound";

const BASE_CELL_SIZE = 30; // 픽셀 단위 격자 크기
const BASE_MARGIN = 20; // 바둑판 여백

// 화점 위치 계산
const getStarPoints = (size: number) => {
  if (size < 9) return [];
  const edge = size >= 13 ? 3 : 2;
  const mid = Math.floor(size / 2);
  const far = size - 1 - edge;
  const points = [
    [edge, edge], [far, edge], [edge, far], [far, far],
  ];
  if (size >= 13) {
    points.push([mid, edge], [edge, mid], [far, mid], [mid, far], [mid, mid]);
  } else if (size % 2 === 1) {
    points.push([mid, mid]);
  }
  return points;
};

const BoardCore: React.FC = () => {
  const {
    boardSize,
    board,
    placeStone,
    moveCoordinates,
    currentMoveIndex,
    isTeacherMode,
    currentPlayer,
    isGameOver,
    gameMode,
    humanPlayerColor,
    isReviewMode,
    boardScale,
    soundEnabled,
    soundVolume,
    ignoredRecommendation,
    aiDifficulty,
    teacherVisits,
    language,
    handicap,
    deadStones,
  } = useGameStore();

  const CELL_SIZE = BASE_CELL_SIZE * boardScale;
  const MARGIN = BASE_MARGIN * boardScale;
  const BOARD_PIXEL_SIZE = CELL_SIZE * (boardSize - 1) + MARGIN * 2;

  const handleBoardClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (gameMode === "PvAI" && currentPlayer !== humanPlayerColor) return;
    if (isReviewMode) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xPixel = e.clientX - rect.left - MARGIN;
    const yPixel = e.clientY - rect.top - MARGIN;

    const x = Math.round(xPixel / CELL_SIZE);
    const y = Math.round(yPixel / CELL_SIZE);

    if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
      placeStone(x, y);
      playStoneSound(soundEnabled, soundVolume);
    }
  };

  const lastMove = moveCoordinates[currentMoveIndex];

  const { data: aiData } = useQuery({
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

  return (
    <svg
      width={BOARD_PIXEL_SIZE}
      height={BOARD_PIXEL_SIZE}
      className="cursor-pointer select-none"
      onClick={handleBoardClick}
      role="grid"
      aria-label="Go Board"
    >
      {/* 격자 선 그리기 */}
      {Array.from({ length: boardSize }).map((_, i) => (
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
      ))}

      {/* 화점 그리기 */}
      {getStarPoints(boardSize).map(([x, y]) => (
        <circle
          key={`star-${x}-${y}`}
          cx={MARGIN + x * CELL_SIZE}
          cy={MARGIN + y * CELL_SIZE}
          r="3"
          fill="var(--board-line)"
        />
      ))}

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
        ignoredRecommendation.map((rec: { x: number; y: number }, idx: number) => {
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
        })}

      {/* 돌 그리기 */}
      {board.map((row, y) =>
        row.map((stone, x) => {
          if (!stone) return null;
          const isLastMove = lastMove?.x === x && lastMove?.y === y;
          const isDead = isGameOver && deadStones?.some((ds) => ds.x === x && ds.y === y);

          return (
            <g key={`stone-group-${x}-${y}`} className={isDead ? "opacity-40" : ""}>
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
                  fill={stone === "BLACK" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)"}
                />
              )}
            </g>
          );
        }),
      )}

      {/* 사석 표시 레이어 (최상단) */}
      {isGameOver && deadStones && deadStones.map((ds, idx) => {
        const stone = board[ds.y] ? board[ds.y][ds.x] : null;
        if (!stone) return null;
        return (
          <g key={`dead-mark-${idx}`} stroke="#ff0000" strokeWidth="3" strokeLinecap="round" style={{ pointerEvents: "none" }}>
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

export default BoardCore;
