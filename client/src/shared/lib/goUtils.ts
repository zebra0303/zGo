import { PlayerColor } from "@/shared/types/board";

/**
 * Determine whose turn it is at a given moveIndex, accounting for handicap.
 * With handicap > 0, WHITE moves first (even indices = WHITE).
 * Without handicap, BLACK moves first (even indices = BLACK).
 */
export const getPlayerForMove = (
  moveIndex: number,
  handicap: number,
): PlayerColor =>
  handicap > 0
    ? moveIndex % 2 === 0
      ? "WHITE"
      : "BLACK"
    : moveIndex % 2 === 0
      ? "BLACK"
      : "WHITE";

/**
 * Build an array of moves from a path of HistoryNodes (excluding root).
 * Each move is {x, y} or null (for pass moves).
 */
export const buildMoveHistory = (
  path: { x: number | null; y: number | null }[],
): ({ x: number; y: number } | null)[] => {
  const moves: ({ x: number; y: number } | null)[] = [];
  for (let i = 1; i < path.length; i++) {
    const node = path[i];
    moves.push(
      node.x !== null && node.y !== null ? { x: node.x, y: node.y } : null,
    );
  }
  return moves;
};
