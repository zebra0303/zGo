const { 
  coordsToGtp, 
  gtpToCoords, 
  getHandicapStones,
  getMoveTactics 
} = require("../index.js");

// Mocking board for tactics test
const createEmptyBoard = (size = 19) => Array(size).fill(null).map(() => Array(size).fill(null));

describe("Server Logic (GTP & Tactics)", () => {
  test("coordsToGtp conversion", () => {
    // 19x19 board
    expect(coordsToGtp(0, 18, 19)).toBe("A1");
    expect(coordsToGtp(3, 15, 19)).toBe("D4"); // Tengen or Star point 
    expect(coordsToGtp(18, 0, 19)).toBe("T19");
    expect(coordsToGtp(8, 9, 19)).toBe("J10"); // Note: 'I' is skipped in GTP
  });

  test("gtpToCoords conversion", () => {
    expect(gtpToCoords("A1", 19)).toEqual({ x: 0, y: 18 });
    expect(gtpToCoords("D4", 19)).toEqual({ x: 3, y: 15 });
    expect(gtpToCoords("T19", 19)).toEqual({ x: 18, y: 0 });
    expect(gtpToCoords("J10", 19)).toEqual({ x: 8, y: 9 });
    expect(gtpToCoords("pass", 19)).toBeNull();
  });

  test("getHandicapStones for 19x19 board", () => {
    const h2 = getHandicapStones(19, 2);
    expect(h2.length).toBe(2);
    // Should be at max, min and min, max
    expect(h2).toContainEqual({ x: 15, y: 3 });
    expect(h2).toContainEqual({ x: 3, y: 15 });

    const h9 = getHandicapStones(19, 9);
    expect(h9.length).toBe(9);
    // Should include center (9, 9)
    expect(h9).toContainEqual({ x: 9, y: 9 });
  });

  test("getMoveTactics should detect capture", () => {
    const board = createEmptyBoard();
    // Surround (1,1) with White, leaving only one liberty
    board[0][1] = "WHITE";
    board[2][1] = "WHITE";
    board[1][0] = "WHITE";
    board[1][1] = "BLACK"; // Target

    // Move to (1,2) to capture (1,1)
    const result = getMoveTactics(2, 1, board, "W", "en", 19);
    expect(result.type).toBe("capture");
  });

  test("getMoveTactics should detect atari", () => {
    const board = createEmptyBoard();
    // (1,1) has 2 liberties
    board[0][1] = "WHITE";
    board[2][1] = "WHITE";
    board[1][1] = "BLACK";

    // Move to (1,0) to put (1,1) in atari (1 liberty left)
    const result = getMoveTactics(0, 1, board, "W", "en", 19);
    expect(result.type).toBe("atari");
  });
});
