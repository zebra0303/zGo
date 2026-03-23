import { describe, it, expect } from "vitest";
import { getPlayerForMove, buildMoveHistory } from "../shared/lib/goUtils";

describe("goUtils", () => {
  describe("getPlayerForMove", () => {
    it("should return correct player when handicap is 0", () => {
      expect(getPlayerForMove(0, 0)).toBe("BLACK");
      expect(getPlayerForMove(1, 0)).toBe("WHITE");
      expect(getPlayerForMove(2, 0)).toBe("BLACK");
    });

    it("should return correct player when handicap > 0", () => {
      expect(getPlayerForMove(0, 2)).toBe("WHITE");
      expect(getPlayerForMove(1, 2)).toBe("BLACK");
      expect(getPlayerForMove(2, 2)).toBe("WHITE");
    });
  });

  describe("buildMoveHistory", () => {
    it("should build move history from a path of nodes", () => {
      const path = [
        { x: null, y: null }, // root
        { x: 3, y: 3 }, // move 1
        { x: null, y: null }, // pass
        { x: 15, y: 15 }, // move 3
      ];

      const moves = buildMoveHistory(path);

      expect(moves).toEqual([{ x: 3, y: 3 }, null, { x: 15, y: 15 }]);
      expect(moves).toHaveLength(3);
    });

    it("should return empty array for path with only root", () => {
      const path = [{ x: null, y: null }];
      const moves = buildMoveHistory(path);
      expect(moves).toEqual([]);
    });
  });
});
