// Shared Go game logic (copied from client for server-side move validation)

export type PlayerColor = "BLACK" | "WHITE";
export type PointState = PlayerColor | null;
export type BoardState = PointState[][];

interface Group {
  stones: { x: number; y: number }[];
  liberties: Set<string>;
  color: PlayerColor;
}

const getNeighbors = (
  x: number,
  y: number,
  boardSize: number,
): { x: number; y: number }[] => {
  const neighbors = [];
  if (x > 0) neighbors.push({ x: x - 1, y });
  if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
  if (y > 0) neighbors.push({ x, y: y - 1 });
  if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
  return neighbors;
};

const getGroup = (
  board: BoardState,
  startX: number,
  startY: number,
): Group | null => {
  const color = board[startY][startX];
  if (!color) return null;
  const boardSize = board.length;

  const stones: { x: number; y: number }[] = [];
  const liberties = new Set<string>();
  const visited = new Set<string>();
  const queue = [{ x: startX, y: startY }];

  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    stones.push({ x, y });

    for (const { x: nx, y: ny } of getNeighbors(x, y, boardSize)) {
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
  if (b1.length !== b2.length) return false;
  const boardSize = b1.length;
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
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
  const boardSize = board.length;
  if (
    x < 0 ||
    x >= boardSize ||
    y < 0 ||
    y >= boardSize ||
    board[y][x] !== null
  )
    return { newBoard: board, captured: 0, isValid: false, reason: "Occupied" };

  const newBoard = board.map((row) => [...row]);
  newBoard[y][x] = color;

  const opponentColor = color === "BLACK" ? "WHITE" : "BLACK";
  let totalCaptured = 0;
  const processedGroups = new Set<string>();

  for (const { x: nx, y: ny } of getNeighbors(x, y, boardSize)) {
    if (newBoard[ny][nx] === opponentColor) {
      const key = `${nx},${ny}`;
      if (processedGroups.has(key)) continue;

      const group = getGroup(newBoard, nx, ny);
      if (group && group.liberties.size === 0) {
        for (const stone of group.stones) {
          newBoard[stone.y][stone.x] = null;
          processedGroups.add(`${stone.x},${stone.y}`);
          totalCaptured++;
        }
      }
    }
  }

  if (totalCaptured === 0) {
    const myGroup = getGroup(newBoard, x, y);
    if (myGroup && myGroup.liberties.size === 0) {
      return {
        newBoard: board,
        captured: 0,
        isValid: false,
        reason: "Suicide",
      };
    }
  }

  if (previousBoard && isBoardsEqual(newBoard, previousBoard)) {
    return { newBoard: board, captured: 0, isValid: false, reason: "Ko" };
  }

  return { newBoard, captured: totalCaptured, isValid: true };
};

/**
 * Creates an empty board of the given size.
 */
export const createEmptyBoard = (size: number): BoardState =>
  Array.from({ length: size }, () => Array(size).fill(null));

/**
 * Rebuilds board state from a list of moves.
 * Returns the current board, previous board (for ko check), and captured counts.
 */
export const replayMoves = (
  moves: ({ x: number; y: number } | null)[],
  boardSize: number,
  handicap: number,
): {
  board: BoardState;
  previousBoard: BoardState | null;
  currentPlayer: PlayerColor;
  capturedByBlack: number;
  capturedByWhite: number;
} => {
  let board = createEmptyBoard(boardSize);
  let previousBoard: BoardState | null = null;
  let capturedByBlack = 0;
  let capturedByWhite = 0;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const color: PlayerColor =
      handicap > 0
        ? i % 2 === 0
          ? "WHITE"
          : "BLACK"
        : i % 2 === 0
          ? "BLACK"
          : "WHITE";

    if (move === null) {
      // pass
      previousBoard = board;
      continue;
    }

    const result = applyMove(board, move.x, move.y, color, previousBoard);
    if (result.isValid) {
      previousBoard = board;
      board = result.newBoard;
      if (color === "BLACK") capturedByBlack += result.captured;
      else capturedByWhite += result.captured;
    }
  }

  const nextColor: PlayerColor =
    handicap > 0
      ? moves.length % 2 === 0
        ? "WHITE"
        : "BLACK"
      : moves.length % 2 === 0
        ? "BLACK"
        : "WHITE";

  return {
    board,
    previousBoard,
    currentPlayer: nextColor,
    capturedByBlack,
    capturedByWhite,
  };
};
