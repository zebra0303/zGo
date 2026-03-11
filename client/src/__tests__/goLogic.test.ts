import { describe, it, expect } from "vitest";
import { applyMove } from "@/entities/board/lib/goLogic";
import { BoardState } from "@/entities/board/model/types";

describe("Go Logic (applyMove)", () => {
  const createEmptyBoard = (): BoardState => {
    return Array(19)
      .fill(null)
      .map(() => Array(19).fill(null));
  };

  it("should place a stone on an empty board", () => {
    const board = createEmptyBoard();
    const result = applyMove(board, 3, 3, "BLACK");
    expect(result.isValid).toBe(true);
    expect(result.newBoard[3][3]).toBe("BLACK");
    expect(result.captured).toBe(0);
  });

  it("should reject a move on an already occupied intersection", () => {
    const board = createEmptyBoard();
    board[3][3] = "BLACK";
    const result = applyMove(board, 3, 3, "WHITE");
    expect(result.isValid).toBe(false);
    expect(result.captured).toBe(0);
  });

  it("should capture a single surrounded stone", () => {
    const board = createEmptyBoard();
    board[1][2] = "BLACK"; // 북
    board[3][2] = "BLACK"; // 남
    board[2][1] = "BLACK"; // 서
    board[2][2] = "WHITE"; // 가운데 백돌

    // 동쪽에 흑돌을 놓아 백돌을 둘러쌉니다.
    const result = applyMove(board, 3, 2, "BLACK"); // (x=3, y=2)

    expect(result.isValid).toBe(true);
    expect(result.captured).toBe(1);
    expect(result.newBoard[2][2]).toBe(null); // 백돌 제거됨
  });

  it("should reject a suicide move", () => {
    const board = createEmptyBoard();
    board[1][2] = "BLACK"; // 북
    board[3][2] = "BLACK"; // 남
    board[2][1] = "BLACK"; // 서
    board[2][3] = "BLACK"; // 동

    // 백이 사방이 막힌 곳에 돌을 놓음 (따낼 돌도 없음)
    const result = applyMove(board, 2, 2, "WHITE");

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("Suicide");
  });

  it("should enforce the Ko rule", () => {
    const board1 = createEmptyBoard();
    // 패(Ko) 모양 만들기

    // (x=2, y=2)를 3면에서 둘러싼 백돌들
    board1[2][1] = "WHITE"; // 좌 (x=1, y=2)
    board1[1][2] = "WHITE"; // 상 (x=2, y=1)
    board1[3][2] = "WHITE"; // 하 (x=2, y=3)

    // (x=3, y=2)를 3면에서 둘러싼 흑돌들
    board1[2][4] = "BLACK"; // 우 (x=4, y=2)
    board1[1][3] = "BLACK"; // 상 (x=3, y=1)
    board1[3][3] = "BLACK"; // 하 (x=3, y=3)

    // 타겟: (x=3, y=2)에 위치한 백돌 (현재 활로는 2,2 하나뿐)
    board1[2][3] = "WHITE";

    // 1. 흑이 (2,2)에 두어 백돌(3,2)을 따냄
    const move1 = applyMove(board1, 2, 2, "BLACK");
    expect(move1.isValid).toBe(true);
    expect(move1.captured).toBe(1);
    expect(move1.newBoard[2][3]).toBe(null); // 백돌이 제거되었는지 확인

    const board2 = move1.newBoard;

    // 2. 백이 즉시 (3,2)에 다시 두어 흑돌(2,2)을 따내려 함
    // previousBoard(board1)와 동일한 상태로 돌아가므로 패 규칙(Ko)에 의해 거절되어야 함
    const move2 = applyMove(board2, 3, 2, "WHITE", board1);

    expect(move2.isValid).toBe(false);
    expect(move2.reason).toBe("Ko");
  });
});
