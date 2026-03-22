import { t } from "../shared/lib/i18n";

type BoardState = (string | null)[][];

interface TacticsResult {
  type: string;
  urgency: number;
  label: string;
}

export const getMoveTactics = (
  x: number,
  y: number,
  board: BoardState,
  color: string,
  language = "ko",
  boardSize = 19,
): TacticsResult => {
  const opponent = color === "B" ? "WHITE" : "BLACK";
  const myColor = color === "B" ? "BLACK" : "WHITE";
  const actualBoardSize = board?.length || boardSize;

  const getLiberties = (tx: number, ty: number): number => {
    let libs = 0;
    const visited = new Set<string>();
    const stack: [number, number][] = [[tx, ty]];
    if (!board[ty] || board[ty][tx] === undefined) return 0;
    const targetColor = board[ty][tx];
    visited.add(`${tx},${ty}`);
    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;
      for (const [dx, dy] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as const) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (
          nx >= 0 &&
          nx < actualBoardSize &&
          ny >= 0 &&
          ny < actualBoardSize
        ) {
          const key = `${nx},${ny}`;
          if (!visited.has(key)) {
            if (board[ny] && board[ny][nx] === null) {
              libs++;
              visited.add(key);
            } else if (board[ny] && board[ny][nx] === targetColor) {
              visited.add(key);
              stack.push([nx, ny]);
            }
          }
        }
      }
    }
    return libs;
  };

  let isCapture = false;
  let isAtari = false;
  let isSaving = false;
  let isConnection = false;
  let isCut = false;

  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < actualBoardSize && ny >= 0 && ny < actualBoardSize) {
      if (!board[ny]) continue;
      const stone = board[ny][nx];
      if (stone === opponent) {
        const libs = getLiberties(nx, ny);
        if (libs === 1) isCapture = true;
        if (libs === 2) isAtari = true;
      } else if (stone === myColor) {
        if (getLiberties(nx, ny) === 1) isSaving = true;
        isConnection = true;
      }
    }
  }

  let oppCount = 0;
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (
      nx >= 0 &&
      nx < actualBoardSize &&
      ny >= 0 &&
      ny < actualBoardSize &&
      board[ny] &&
      board[ny][nx] === opponent
    )
      oppCount++;
  }
  if (oppCount >= 2) isCut = true;

  const cornerLimit = actualBoardSize >= 13 ? 3 : 2;
  const isCorner =
    (x <= cornerLimit || x >= actualBoardSize - 1 - cornerLimit) &&
    (y <= cornerLimit || y >= actualBoardSize - 1 - cornerLimit);
  const sideLimit = actualBoardSize >= 13 ? 2 : 1;
  const isSide =
    (x <= sideLimit ||
      x >= actualBoardSize - 1 - sideLimit ||
      y <= sideLimit ||
      y >= actualBoardSize - 1 - sideLimit) &&
    !isCorner;

  if (isCapture)
    return {
      type: "capture",
      urgency: 1,
      label: t(language, "tactics.capture.label"),
    };
  if (isSaving)
    return {
      type: "saving",
      urgency: 2,
      label: t(language, "tactics.saving.label"),
    };
  if (isAtari)
    return {
      type: "atari",
      urgency: 3,
      label: t(language, "tactics.atari.label"),
    };
  if (isCut)
    return {
      type: "cut",
      urgency: 4,
      label: t(language, "tactics.cut.label"),
    };
  if (isConnection)
    return {
      type: "connection",
      urgency: 5,
      label: t(language, "tactics.connection.label"),
    };
  if (isCorner)
    return {
      type: "corner",
      urgency: 6,
      label: t(language, "tactics.corner.label"),
    };
  if (isSide)
    return {
      type: "side",
      urgency: 7,
      label: t(language, "tactics.side.label"),
    };
  return {
    type: "center",
    urgency: 8,
    label: t(language, "tactics.center.label"),
  };
};

export const getDetailedExplanation = (
  x: number,
  y: number,
  board: BoardState,
  color: string,
  language = "ko",
  boardSize = 19,
): string => {
  const tactics = getMoveTactics(x, y, board, color, language, boardSize);
  return t(language, `tactics.${tactics.type}.explanation`);
};
