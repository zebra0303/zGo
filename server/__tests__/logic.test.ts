import { describe, test, expect } from "vitest";
import {
  coordsToGtp,
  gtpToCoords,
  getHandicapStones,
} from "../src/katago/coords";
import { getMoveTactics, getDetailedExplanation } from "../src/katago/tactics";

const createEmptyBoard = (size = 19): (string | null)[][] =>
  Array(size)
    .fill(null)
    .map(() => Array(size).fill(null));

// ─── Coordinate Conversion ─────────────────────────────────────────────

describe("coordsToGtp", () => {
  test("standard 19x19 coordinates", () => {
    expect(coordsToGtp(0, 18, 19)).toBe("A1");
    expect(coordsToGtp(3, 15, 19)).toBe("D4");
    expect(coordsToGtp(18, 0, 19)).toBe("T19");
    expect(coordsToGtp(8, 9, 19)).toBe("J10"); // 'I' is skipped in GTP
  });

  test("skips column I correctly", () => {
    // Column index 7 = H, column index 8 = J (not I)
    expect(coordsToGtp(7, 0, 19)).toBe("H19");
    expect(coordsToGtp(8, 0, 19)).toBe("J19");
  });

  test("9x9 board coordinates", () => {
    expect(coordsToGtp(0, 8, 9)).toBe("A1");
    expect(coordsToGtp(8, 0, 9)).toBe("J9");
    expect(coordsToGtp(4, 4, 9)).toBe("E5"); // tengen on 9x9
  });

  test("13x13 board coordinates", () => {
    expect(coordsToGtp(0, 12, 13)).toBe("A1");
    expect(coordsToGtp(12, 0, 13)).toBe("N13");
  });
});

describe("gtpToCoords", () => {
  test("standard conversions", () => {
    expect(gtpToCoords("A1", 19)).toEqual({ x: 0, y: 18 });
    expect(gtpToCoords("D4", 19)).toEqual({ x: 3, y: 15 });
    expect(gtpToCoords("T19", 19)).toEqual({ x: 18, y: 0 });
    expect(gtpToCoords("J10", 19)).toEqual({ x: 8, y: 9 });
  });

  test("returns null for pass and resign", () => {
    expect(gtpToCoords("pass", 19)).toBeNull();
    expect(gtpToCoords("resign", 19)).toBeNull();
    expect(gtpToCoords("PASS", 19)).toBeNull();
    expect(gtpToCoords("RESIGN", 19)).toBeNull();
  });

  test("returns null for empty or invalid input", () => {
    expect(gtpToCoords("", 19)).toBeNull();
  });

  test("handles lowercase GTP strings", () => {
    expect(gtpToCoords("a1", 19)).toEqual({ x: 0, y: 18 });
    expect(gtpToCoords("d4", 19)).toEqual({ x: 3, y: 15 });
  });

  test("roundtrip: coordsToGtp → gtpToCoords", () => {
    for (let x = 0; x < 19; x++) {
      for (let y = 0; y < 19; y++) {
        const gtp = coordsToGtp(x, y, 19);
        const coords = gtpToCoords(gtp, 19);
        expect(coords).toEqual({ x, y });
      }
    }
  });
});

// ─── Handicap Stones ────────────────────────────────────────────────────

describe("getHandicapStones", () => {
  test("returns empty for handicap 0 or 1", () => {
    expect(getHandicapStones(19, 0)).toEqual([]);
    expect(getHandicapStones(19, 1)).toEqual([]);
  });

  test("returns empty for small board with handicap", () => {
    expect(getHandicapStones(5, 2)).toEqual([]);
  });

  test("2 handicap stones on 19x19 (opposite corners)", () => {
    const stones = getHandicapStones(19, 2);
    expect(stones).toHaveLength(2);
    expect(stones).toContainEqual({ x: 15, y: 3 });
    expect(stones).toContainEqual({ x: 3, y: 15 });
  });

  test("handicaps 3, 6, 7, 8 on 19x19", () => {
    expect(getHandicapStones(19, 3)).toHaveLength(3);
    expect(getHandicapStones(19, 6)).toHaveLength(6);
    expect(getHandicapStones(19, 7)).toHaveLength(7);
    expect(getHandicapStones(19, 8)).toHaveLength(8);
  });

  test("4 handicap stones on 19x19 (all corners)", () => {
    const stones = getHandicapStones(19, 4);
    expect(stones).toHaveLength(4);
  });

  test("5 handicap adds center point", () => {
    const stones = getHandicapStones(19, 5);
    expect(stones).toHaveLength(5);
    expect(stones).toContainEqual({ x: 9, y: 9 }); // center
  });

  test("9 handicap on 19x19 (all star points)", () => {
    const stones = getHandicapStones(19, 9);
    expect(stones).toHaveLength(9);
    expect(stones).toContainEqual({ x: 9, y: 9 }); // center
    expect(stones).toContainEqual({ x: 3, y: 3 }); // corner
    expect(stones).toContainEqual({ x: 3, y: 9 }); // side
  });

  test("9x9 board uses offset 2 instead of 3", () => {
    const stones = getHandicapStones(9, 4);
    expect(stones).toHaveLength(4);
    // On 9x9, min=2, max=6
    expect(stones).toContainEqual({ x: 6, y: 2 });
    expect(stones).toContainEqual({ x: 2, y: 6 });
  });

  test("13x13 board handicap", () => {
    const stones = getHandicapStones(13, 5);
    expect(stones).toHaveLength(5);
    expect(stones).toContainEqual({ x: 6, y: 6 }); // center of 13x13
  });
});

// ─── Move Tactics ───────────────────────────────────────────────────────

describe("getMoveTactics", () => {
  test("detects capture (opponent has 1 liberty)", () => {
    const board = createEmptyBoard();
    board[0][1] = "WHITE";
    board[2][1] = "WHITE";
    board[1][0] = "WHITE";
    board[1][1] = "BLACK"; // 1 liberty at (2,1)

    const result = getMoveTactics(2, 1, board, "W", "en", 19);
    expect(result.type).toBe("capture");
    expect(result.urgency).toBe(1);
  });

  test("detects saving (own stone has 1 liberty)", () => {
    const board = createEmptyBoard();
    board[0][1] = "BLACK";
    board[2][1] = "BLACK";
    board[1][0] = "BLACK";
    board[1][1] = "WHITE"; // White stone with 1 liberty at (1,2)

    // White plays at (1,2) to save its stone at (1,1)
    const result = getMoveTactics(1, 2, board, "W", "en", 19);
    expect(result.type).toBe("saving");
    expect(result.urgency).toBe(2);
  });

  test("calculates liberties for a group of stones > 1", () => {
    const board = createEmptyBoard();
    // A group of 2 white stones
    board[1][1] = "WHITE";
    board[1][2] = "WHITE";

    // Surround them except for one liberty
    board[0][1] = "BLACK";
    board[0][2] = "BLACK";
    board[1][0] = "BLACK";
    board[1][3] = "BLACK";
    board[2][1] = "BLACK";
    // liberty at (2,2)

    const result = getMoveTactics(2, 2, board, "W", "en", 19);
    expect(result.type).toBe("saving"); // since it has 1 liberty before playing
  });

  test("detects atari (opponent has 2 liberties)", () => {
    const board = createEmptyBoard();
    board[0][1] = "WHITE";
    board[2][1] = "WHITE";
    board[1][1] = "BLACK"; // 2 liberties

    const result = getMoveTactics(0, 1, board, "W", "en", 19);
    expect(result.type).toBe("atari");
    expect(result.urgency).toBe(3);
  });

  test("detects cut (2+ opponent stones adjacent)", () => {
    const board = createEmptyBoard();
    board[9][10] = "WHITE";
    board[11][10] = "WHITE";

    const result = getMoveTactics(10, 10, board, "B", "en", 19);
    expect(result.type).toBe("cut");
    expect(result.urgency).toBe(4);
  });

  test("detects connection (own stone adjacent)", () => {
    const board = createEmptyBoard();
    board[10][10] = "BLACK";

    const result = getMoveTactics(10, 11, board, "B", "en", 19);
    expect(result.type).toBe("connection");
    expect(result.urgency).toBe(5);
  });

  test("detects corner move", () => {
    const board = createEmptyBoard();
    const result = getMoveTactics(3, 3, board, "B", "en", 19);
    expect(result.type).toBe("corner");
    expect(result.urgency).toBe(6);
  });

  test("detects side move", () => {
    const board = createEmptyBoard();
    const result = getMoveTactics(9, 1, board, "B", "en", 19);
    expect(result.type).toBe("side");
    expect(result.urgency).toBe(7);
  });

  test("detects center move", () => {
    const board = createEmptyBoard();
    const result = getMoveTactics(9, 9, board, "B", "en", 19);
    expect(result.type).toBe("center");
    expect(result.urgency).toBe(8);
  });

  test("returns Korean labels when language is ko", () => {
    const board = createEmptyBoard();
    const result = getMoveTactics(9, 9, board, "B", "ko", 19);
    expect(result.label).toBe("중앙으로 나아가는 수");
  });

  test("returns English labels when language is en", () => {
    const board = createEmptyBoard();
    const result = getMoveTactics(9, 9, board, "B", "en", 19);
    expect(result.label).toBe("Move towards the center");
  });

  test("priority: capture > saving > atari > cut > connection", () => {
    // Capture has the highest urgency (lowest number)
    const board = createEmptyBoard();
    board[0][1] = "WHITE";
    board[2][1] = "WHITE";
    board[1][0] = "WHITE";
    board[1][1] = "BLACK"; // 1 liberty — capture at (2,1)
    board[1][3] = "WHITE"; // own stone adjacent — also connection

    const result = getMoveTactics(2, 1, board, "W", "en", 19);
    expect(result.type).toBe("capture"); // capture wins over connection
  });

  test("works on 9x9 board", () => {
    const board = createEmptyBoard(9);
    const result = getMoveTactics(4, 4, board, "B", "en", 9);
    expect(result.type).toBe("center");
  });
});

// ─── Detailed Explanation ───────────────────────────────────────────────

describe("getDetailedExplanation", () => {
  test("returns Korean explanation for capture", () => {
    const board = createEmptyBoard();
    board[0][1] = "WHITE";
    board[2][1] = "WHITE";
    board[1][0] = "WHITE";
    board[1][1] = "BLACK";

    const explanation = getDetailedExplanation(2, 1, board, "W", "ko", 19);
    expect(explanation).toContain("따낼 수 있는");
  });

  test("returns English explanation for capture", () => {
    const board = createEmptyBoard();
    board[0][1] = "WHITE";
    board[2][1] = "WHITE";
    board[1][0] = "WHITE";
    board[1][1] = "BLACK";

    const explanation = getDetailedExplanation(2, 1, board, "W", "en", 19);
    expect(explanation).toContain("capture");
  });

  test("returns explanation for all tactic types", () => {
    const board = createEmptyBoard();
    // Center move — simplest to set up
    const explanation = getDetailedExplanation(9, 9, board, "B", "en", 19);
    expect(explanation.length).toBeGreaterThan(10);
    expect(explanation).toContain("center");
  });

  test("returns Korean default when type is unknown", () => {
    const board = createEmptyBoard();
    const explanation = getDetailedExplanation(9, 9, board, "B", "ko", 19);
    expect(explanation).toContain("중앙");
  });

  test("falls back to Korean for unsupported language", () => {
    const board = createEmptyBoard();
    // "ja" is not supported, should fall back to "ko"
    const explanation = getDetailedExplanation(9, 9, board, "B", "ja", 19);
    expect(explanation).toContain("중앙");
  });
});
