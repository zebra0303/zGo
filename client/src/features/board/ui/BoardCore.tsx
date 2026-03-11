import React from "react";
import { useGameStore } from "@/entities/match/model/store";
import { useQuery } from "@tanstack/react-query";
import { fetchAIHint } from "@/shared/api/gameApi";
import { playStoneSound } from "@/shared/lib/sound";

const BOARD_SIZE = 19;
const BASE_CELL_SIZE = 30; // 픽셀 단위 격자 크기
const BASE_MARGIN = 20; // 바둑판 여백

// 화점 위치
const STAR_POINTS = [
  [3, 3],
  [9, 3],
  [15, 3],
  [3, 9],
  [9, 9],
  [15, 9],
  [3, 15],
  [9, 15],
  [15, 15],
];

const BoardCore: React.FC = () => {
  const {
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
    ignoredRecommendation,
    aiDifficulty,
    teacherVisits,
  } = useGameStore();

  const CELL_SIZE = BASE_CELL_SIZE * boardScale;
  const MARGIN = BASE_MARGIN * boardScale;
  const BOARD_PIXEL_SIZE = CELL_SIZE * (BOARD_SIZE - 1) + MARGIN * 2;

  const handleBoardClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // AI 모드일 때 사용자의 차례가 아니면 클릭 무시
    if (gameMode === "PvAI" && currentPlayer !== humanPlayerColor) return;

    // 복기 모드일 때도 클릭 무시 (이미 스토어에서 막혀있지만 UX를 위해 추가)
    if (isReviewMode) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xPixel = e.clientX - rect.left - MARGIN;
    const yPixel = e.clientY - rect.top - MARGIN;

    // 가장 가까운 교차점 계산
    const x = Math.round(xPixel / CELL_SIZE);
    const y = Math.round(yPixel / CELL_SIZE);

    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
      placeStone(x, y);
      playStoneSound(soundEnabled);
    }
  };

  const lastMove = moveCoordinates[currentMoveIndex];

  // AI 힌트 데이터 공유 (SidebarWidget과 동일한 queryKey 및 queryFn 사용)
  const { data: aiData } = useQuery({
    queryKey: [
      "aiHint",
      currentMoveIndex,
      currentPlayer,
      aiDifficulty,
      teacherVisits,
      moveCoordinates,
    ],
    queryFn: ({ signal }) =>
      fetchAIHint(
        board,
        currentPlayer,
        aiDifficulty,
        teacherVisits,
        moveCoordinates.slice(1, currentMoveIndex + 1),
        signal,
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
      {Array.from({ length: BOARD_SIZE }).map((_, i) => (
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
      {STAR_POINTS.map(([x, y]) => (
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

      {/* 선생님의 지시 흔적 (무시된 추천) */}
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
              stroke={`rgba(34, 197, 94, ${strokeOpacity})`} // green color with varying opacity
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

          return (
            <g key={`stone-group-${x}-${y}`}>
              <circle
                cx={MARGIN + x * CELL_SIZE}
                cy={MARGIN + y * CELL_SIZE}
                r={CELL_SIZE / 2.2}
                fill={stone === "BLACK" ? "#000000" : "#ffffff"}
                stroke={stone === "WHITE" ? "#cccccc" : "#333333"}
                strokeWidth="1"
                className="drop-shadow-md transition-all duration-200"
              />
              {/* 마지막 수 표시 */}
              {isLastMove && (
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
      )}
    </svg>
  );
};

export default BoardCore;
