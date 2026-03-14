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
      label:
        language === "en"
          ? "Move to capture opponent's stones"
          : "상대 돌을 따내는 수",
    };
  if (isSaving)
    return {
      type: "saving",
      urgency: 2,
      label:
        language === "en"
          ? "Move to save endangered stones"
          : "위험한 내 돌을 살리는 수",
    };
  if (isAtari)
    return {
      type: "atari",
      urgency: 3,
      label:
        language === "en"
          ? "Move to put opponent in Atari"
          : "상대를 단수로 모는 수",
    };
  if (isCut)
    return {
      type: "cut",
      urgency: 4,
      label:
        language === "en"
          ? "Move to cut opponent's connection"
          : "상대의 연결을 끊는 수",
    };
  if (isConnection)
    return {
      type: "connection",
      urgency: 5,
      label:
        language === "en"
          ? "Solid move to connect stones"
          : "내 돌을 연결하는 두터운 수",
    };
  if (isCorner)
    return {
      type: "corner",
      urgency: 6,
      label:
        language === "en"
          ? "Move to secure corner territory"
          : "귀의 실리를 챙기는 수",
    };
  if (isSide)
    return {
      type: "side",
      urgency: 7,
      label:
        language === "en"
          ? "Move to expand along the side"
          : "변을 확장하는 수",
    };
  return {
    type: "center",
    urgency: 8,
    label:
      language === "en" ? "Move towards the center" : "중앙으로 나아가는 수",
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
  const reasons: Record<string, Record<string, string>> = {
    ko: {
      capture:
        "상대의 돌을 따낼 수 있는 아주 좋은 찬스입니다! 수읽기의 승리이며 국면의 주도권을 확실히 가져올 수 있습니다.",
      saving:
        "자신의 돌이 단수 상태이거나 위험에 처해 있습니다. 이 돌을 살려내어 큰 손실을 막아야 하는 긴급한 상황입니다.",
      atari:
        "상대의 돌을 단수(Atari)로 몰아 압박하는 수입니다. 상대의 응수를 강요하며 주도적으로 국면을 이끌 수 있습니다.",
      cut: "상대 진영의 약점을 찔러 돌을 끊어가는 날카로운 수입니다. 상대의 연결을 방해하고 혼란을 줄 수 있습니다.",
      connection:
        "자신의 돌들을 튼튼하게 연결하는 두터운 수입니다. 약점을 보강하여 상대의 역습을 원천 봉쇄합니다.",
      corner:
        "귀의 실리를 차지하거나 굳히는 포석의 급소입니다. 초반 주도권과 확실한 집을 확보하기 위해 가장 먼저 두어야 할 자리입니다.",
      side: "변으로 전개하여 세력을 넓히는 효율적인 수입니다. 상대의 침입을 방어하면서 동시에 자신의 집 모양을 키울 수 있습니다.",
      center:
        "중앙의 두터움을 쌓아 전체적인 국면의 흐름을 조율하는 수입니다. 장기적인 안목에서 판을 넓게 보는 선택입니다.",
      default: "AI 엔진이 분석한 현재 국면의 급소입니다.",
    },
    en: {
      capture:
        "Great chance to capture opponent stones! A tactical win that takes control.",
      saving:
        "Your stones are in danger. It's urgent to save them to prevent huge loss.",
      atari:
        "Puts the opponent in Atari to pressure them. Forces a response and takes the lead.",
      cut: "A sharp move that cuts the opponent's weak points. Disrupts connection and causes chaos.",
      connection:
        "A thick move that solidly connects your stones. Prevents opponent's counterattack.",
      corner:
        "Crucial opening move to secure corner territory. Takes early initiative.",
      side: "Efficient move to expand along the side. Defends while growing your framework.",
      center:
        "Builds thickness in the center to control the game flow. A long-term strategic choice.",
      default: "A key point analyzed by the AI engine.",
    },
  };
  const lang = reasons[language] || reasons["ko"];
  return lang[tactics.type] || lang["default"];
};
