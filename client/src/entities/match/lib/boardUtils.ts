import { BoardState } from "@/shared/types/board";
import { HistoryNode } from "@/entities/match/model/types";

export const createEmptyBoard = (size: number = 19): BoardState => {
  return Array(size)
    .fill(null)
    .map(() => Array(size).fill(null));
};

export const getHandicapStones = (boardSize: number, handicap: number) => {
  let coords: { x: number; y: number }[] = [];
  if (handicap > 1 && boardSize >= 9) {
    const min = boardSize >= 13 ? 3 : 2;
    const max = boardSize - 1 - min;
    const mid = Math.floor(boardSize / 2);

    const corners = [
      { x: max, y: min },
      { x: min, y: max },
      { x: max, y: max },
      { x: min, y: min },
    ];
    const sides = [
      { x: min, y: mid },
      { x: max, y: mid },
      { x: mid, y: min },
      { x: mid, y: max },
    ];
    const center = { x: mid, y: mid };

    if (handicap === 2) coords = [corners[0], corners[1]];
    else if (handicap === 3) coords = [corners[0], corners[1], corners[2]];
    else if (handicap === 4) coords = corners;
    else if (handicap === 5) coords = [...corners, center];
    else if (handicap === 6) coords = [...corners, sides[0], sides[1]];
    else if (handicap === 7) coords = [...corners, sides[0], sides[1], center];
    else if (handicap === 8) coords = [...corners, ...sides];
    else if (handicap >= 9) coords = [...corners, ...sides, center];
  }
  return coords;
};

export const setupInitialBoard = (
  boardSize: number,
  handicap: number,
): BoardState => {
  const board = createEmptyBoard(boardSize);
  const stones = getHandicapStones(boardSize, handicap);
  stones.forEach(({ x, y }) => {
    if (board[y] && board[y][x] === null) {
      board[y][x] = "BLACK";
    }
  });
  return board;
};

export const createInitialNode = (
  boardSize: number,
  handicap: number,
): HistoryNode => {
  const board = setupInitialBoard(boardSize, handicap);
  return {
    id: "root",
    x: null,
    y: null,
    color: null,
    board: board,
    capturedByBlack: 0,
    capturedByWhite: 0,
    winRate: 50,
    children: [],
    parent: null,
    moveIndex: 0,
  };
};

export const getNode = (root: HistoryNode, id: string): HistoryNode | null => {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = getNode(child, id);
    if (found) return found;
  }
  return null;
};

export const getPathToNode = (
  root: HistoryNode,
  id: string,
): HistoryNode[] | null => {
  if (root.id === id) return [root];
  for (const child of root.children) {
    const path = getPathToNode(child, id);
    if (path) return [root, ...path];
  }
  return null;
};
