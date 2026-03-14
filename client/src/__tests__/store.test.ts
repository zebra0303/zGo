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

  it("should handle variations in game tree", () => {
    useGameStore.getState().resetGame();
    const store = useGameStore.getState();

    // 1. 첫 번째 수 (3,3)
    store.placeStone(3, 3);
    const firstNodeId = useGameStore.getState().currentNode.id;

    // 2. 한 수 되돌리기
    useGameStore.getState().goToPreviousMove();
    expect(useGameStore.getState().currentNode.id).toBe("root");

    // 3. 다른 위치에 두기 (변화구/Variation 생성)
    useGameStore.getState().placeStone(4, 4);
    const secondNodeId = useGameStore.getState().currentNode.id;

    // 4. 루트 노드에 두 개의 자식이 있는지 확인
    const tree = useGameStore.getState().gameTree;
    expect(tree.children.length).toBe(2);
    expect(tree.children[0].id).toBe(firstNodeId);
    expect(tree.children[1].id).toBe(secondNodeId);
  });

  it("should navigate through history correctly", () => {
    useGameStore.getState().resetGame();
    
    // 수순 진행: (3, 3) -> (16, 16) -> (3, 16)
    useGameStore.getState().placeStone(3, 3);
    useGameStore.getState().placeStone(16, 16);
    useGameStore.getState().placeStone(3, 16);

    expect(useGameStore.getState().currentNode.moveIndex).toBe(3);

    // 뒤로 가기
    useGameStore.getState().goToPreviousMove();
    expect(useGameStore.getState().currentNode.moveIndex).toBe(2);
    expect(useGameStore.getState().board[16][3]).toBe(null);

    // 앞으로 가기
    useGameStore.getState().goToNextMove(0);
    expect(useGameStore.getState().currentNode.moveIndex).toBe(3);
    expect(useGameStore.getState().board[16][3]).toBe("BLACK");
    });

    it("should restore winner and result text via loadMatch", () => {
    const moves = [null, { x: 3, y: 3 }];
    const winRates = [50, 60];
    const resultText = "Black wins by resignation";
    const winner = "BLACK";

    useGameStore.getState().loadMatch(moves, winRates, resultText, 19, 0, winner);

    const state = useGameStore.getState();
    expect(state.isReviewMode).toBe(true);
    expect(state.gameResultText).toBe(resultText);
    expect(state.winner).toBe("BLACK");
    expect(state.board[3][3]).toBe("BLACK");
    });
    });
