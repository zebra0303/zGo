const GTP_COLUMNS = "ABCDEFGHJKLMNOPQRST";

export interface Coords {
  x: number;
  y: number;
}

export const coordsToGtp = (x: number, y: number, boardSize = 19): string =>
  GTP_COLUMNS[x] + (boardSize - y);

export const gtpToCoords = (
  gtp: string,
  boardSize = 19,
): Coords | null => {
  if (!gtp || ["pass", "resign"].includes(gtp.toLowerCase())) return null;
  return {
    x: GTP_COLUMNS.indexOf(gtp[0].toUpperCase()),
    y: boardSize - parseInt(gtp.substring(1), 10),
  };
};

export const getHandicapStones = (
  boardSize: number,
  handicap: number,
): Coords[] => {
  let coords: Coords[] = [];
  if (handicap > 1 && boardSize >= 9) {
    const min = boardSize >= 13 ? 3 : 2;
    const max = boardSize - 1 - min;
    const mid = Math.floor(boardSize / 2);

    const corners: Coords[] = [
      { x: max, y: min },
      { x: min, y: max },
      { x: max, y: max },
      { x: min, y: min },
    ];
    const sides: Coords[] = [
      { x: min, y: mid },
      { x: max, y: mid },
      { x: mid, y: min },
      { x: mid, y: max },
    ];
    const center: Coords = { x: mid, y: mid };

    if (handicap === 2) coords = [corners[0], corners[1]];
    else if (handicap === 3) coords = [corners[0], corners[1], corners[2]];
    else if (handicap === 4) coords = corners;
    else if (handicap === 5) coords = [...corners, center];
    else if (handicap === 6) coords = [...corners, sides[0], sides[1]];
    else if (handicap === 7)
      coords = [...corners, sides[0], sides[1], center];
    else if (handicap === 8) coords = [...corners, ...sides];
    else if (handicap >= 9) coords = [...corners, ...sides, center];
  }
  return coords;
};
