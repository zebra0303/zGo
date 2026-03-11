import { BoardState, PlayerColor } from "../model/types";

interface Group {
  stones: { x: number; y: number }[];
  liberties: Set<string>;
  color: PlayerColor;
}

const getNeighbors = (x: number, y: number): { x: number; y: number }[] => {
  const neighbors = [];
  if (x > 0) neighbors.push({ x: x - 1, y });
  if (x < 18) neighbors.push({ x: x + 1, y });
  if (y > 0) neighbors.push({ x, y: y - 1 });
  if (y < 18) neighbors.push({ x, y: y + 1 });
  return neighbors;
};

const getGroup = (
  board: BoardState,
  startX: number,
  startY: number,
): Group | null => {
  const color = board[startY][startX];
  if (!color) return null;

  const stones: { x: number; y: number }[] = [];
  const liberties = new Set<string>();
  const visited = new Set<string>();
  const queue = [{ x: startX, y: startY }];

  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    stones.push({ x, y });

    for (const { x: nx, y: ny } of getNeighbors(x, y)) {
      const neighborColor = board[ny][nx];
      const key = `${nx},${ny}`;

      if (neighborColor === null) {
        liberties.add(key);
      } else if (neighborColor === color && !visited.has(key)) {
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return { stones, liberties, color };
};

const isBoardsEqual = (b1: BoardState, b2: BoardState): boolean => {
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (b1[y][x] !== b2[y][x]) return false;
    }
  }
  return true;
};

export const applyMove = (
  board: BoardState,
  x: number,
  y: number,
  color: PlayerColor,
  previousBoard?: BoardState | null,
): {
  newBoard: BoardState;
  captured: number;
  isValid: boolean;
  reason?: string;
} => {
  if (board[y][x] !== null)
    return { newBoard: board, captured: 0, isValid: false, reason: "Occupied" };

  const newBoard = board.map((row) => [...row]);
  newBoard[y][x] = color;

  const opponentColor = color === "BLACK" ? "WHITE" : "BLACK";
  let capturedStones = 0;

  for (const { x: nx, y: ny } of getNeighbors(x, y)) {
    if (newBoard[ny][nx] === opponentColor) {
      const group = getGroup(newBoard, nx, ny);
      if (group && group.liberties.size === 0) {
        for (const stone of group.stones) {
          newBoard[stone.y][stone.x] = null;
          capturedStones++;
        }
      }
    }
  }

  const myGroup = getGroup(newBoard, x, y);
  if (myGroup && myGroup.liberties.size === 0) {
    return { newBoard: board, captured: 0, isValid: false, reason: "Suicide" };
  }

  if (previousBoard && isBoardsEqual(newBoard, previousBoard)) {
    return { newBoard: board, captured: 0, isValid: false, reason: "Ko" };
  }

  return { newBoard, captured: capturedStones, isValid: true };
};
