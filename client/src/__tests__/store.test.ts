import { describe, it, expect } from "vitest";
import { useGameStore } from "@/entities/match/model/store";

describe("Game Store (Zustand)", () => {
  it("should initialize with empty board and BLACK as first player", () => {
    const state = useGameStore.getState();
    expect(state.currentPlayer).toBe("BLACK");
    expect(state.isTeacherMode).toBe(false);
    expect(state.board.length).toBe(19);
    expect(state.board[0].length).toBe(19);
    expect(state.currentNode.id).toBe("root");
  });

  it("should toggle teacher mode", () => {
    useGameStore.getState().toggleTeacherMode();
    expect(useGameStore.getState().isTeacherMode).toBe(true);
    useGameStore.getState().toggleTeacherMode();
    expect(useGameStore.getState().isTeacherMode).toBe(false);
  });

  it("should place a stone and update player turn", () => {
    useGameStore.getState().resetGame();
    useGameStore.getState().placeStone(3, 3);

    const state = useGameStore.getState();
    expect(state.board[3][3]).toBe("BLACK");
    expect(state.currentPlayer).toBe("WHITE");
    expect(state.currentNode.moveIndex).toBe(1);
    expect(state.currentNode.parent?.id).toBe("root");
    expect(state.gameTree.children.length).toBe(1);
  });
});
