import { describe, it, expect } from "vitest";
import {
  createEmptyBoard,
  getHandicapStones,
  setupInitialBoard,
  getNode,
  getPathToNode,
} from "../entities/match/lib/boardUtils";
import { HistoryNode } from "../entities/match/model/types";

describe("boardUtils", () => {
  describe("createEmptyBoard", () => {
    it("should create a board of specified size filled with null", () => {
      const board = createEmptyBoard(9);
      expect(board.length).toBe(9);
      expect(board[0].length).toBe(9);
      expect(board[0][0]).toBeNull();
    });
  });

  describe("getHandicapStones", () => {
    it("should return correct handicap stone coordinates for 19x19", () => {
      const stones = getHandicapStones(19, 2);
      expect(stones).toHaveLength(2);
      // Stones for 2 are corners[0], corners[1]
      // min = 3, max = 15
      expect(stones).toContainEqual({ x: 15, y: 3 });
      expect(stones).toContainEqual({ x: 3, y: 15 });
    });

    it("should return correct stones for handicaps 3 to 8", () => {
      expect(getHandicapStones(19, 3)).toHaveLength(3);
      expect(getHandicapStones(19, 4)).toHaveLength(4);
      expect(getHandicapStones(19, 5)).toHaveLength(5);
      expect(getHandicapStones(19, 6)).toHaveLength(6);
      expect(getHandicapStones(19, 7)).toHaveLength(7);
      expect(getHandicapStones(19, 8)).toHaveLength(8);

      // Test board size < 13
      expect(getHandicapStones(9, 4)).toHaveLength(4);
    });

    it("should return 9 stones for handicap 9", () => {
      const stones = getHandicapStones(19, 9);
      expect(stones).toHaveLength(9);
    });

    it("should return empty for small boards", () => {
      const stones = getHandicapStones(7, 2);
      expect(stones).toHaveLength(0);
    });
  });

  describe("setupInitialBoard", () => {
    it("should place handicap stones on the board", () => {
      const board = setupInitialBoard(19, 2);
      expect(board[3][15]).toBe("BLACK");
      expect(board[15][3]).toBe("BLACK");
    });
  });

  describe("tree navigation", () => {
    const root: HistoryNode = {
      id: "root",
      x: null,
      y: null,
      color: null,
      board: [],
      capturedByBlack: 0,
      capturedByWhite: 0,
      winRate: 50,
      children: [],
      parent: null,
      moveIndex: 0,
    };

    const child1: HistoryNode = {
      ...root,
      id: "child1",
      parent: root,
      moveIndex: 1,
      children: [],
    };
    root.children.push(child1);

    const child2: HistoryNode = {
      ...root,
      id: "child2",
      parent: child1,
      moveIndex: 2,
      children: [],
    };
    child1.children.push(child2);

    it("getNode should find a node by ID", () => {
      expect(getNode(root, "child2")).toBe(child2);
      expect(getNode(root, "nonexistent")).toBeNull();
    });

    it("getPathToNode should return full path from root", () => {
      const path = getPathToNode(root, "child2");
      expect(path).toEqual([root, child1, child2]);
    });
  });
});
