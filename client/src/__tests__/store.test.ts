import { describe, it, expect } from "vitest";
import { useGameStore, getPathToNode } from "@/entities/match/model/store";

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

    useGameStore
      .getState()
      .loadMatch(moves, winRates, resultText, 19, 0, winner);

    const state = useGameStore.getState();
    expect(state.isReviewMode).toBe(true);
    expect(state.gameResultText).toBe(resultText);
    expect(state.winner).toBe("BLACK");
    expect(state.board[3][3]).toBe("BLACK");
  });

  it("should compute branch points from path with variations", () => {
    useGameStore.getState().resetGame();

    // Build a tree: root -> (3,3) -> (4,4) -> (5,5)
    useGameStore.getState().placeStone(3, 3);
    useGameStore.getState().placeStone(4, 4);
    useGameStore.getState().placeStone(5, 5);

    // Go back to move 1 (3,3) and create a variation
    useGameStore.getState().goToPreviousMove(); // at (4,4)
    useGameStore.getState().goToPreviousMove(); // at (3,3)
    useGameStore.getState().placeStone(10, 10); // variation at move 1

    // Now root's child (3,3) should have 2 children: (4,4) and (10,10)
    const tree = useGameStore.getState().gameTree;
    const moveOneNode = tree.children[0]; // (3,3)
    expect(moveOneNode.children.length).toBe(2);

    // Navigate to the variation branch: (3,3) -> (10,10)
    const currentNode = useGameStore.getState().currentNode;
    expect(currentNode.x).toBe(10);
    expect(currentNode.y).toBe(10);

    // getPathToNode should return [root, (3,3), (10,10)]
    const path = getPathToNode(tree, currentNode.id);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3);

    // Identify branch points: only (3,3) has children.length > 1
    const branchPoints = path!
      .slice(0, -1)
      .filter((node) => node.children.length > 1);
    expect(branchPoints.length).toBe(1);
    expect(branchPoints[0].moveIndex).toBe(1);

    // The active child index should be 1 (second child = (10,10))
    const nextInPath = path![path!.indexOf(branchPoints[0]) + 1];
    const activeIdx = branchPoints[0].children.findIndex(
      (c) => c.id === nextInPath.id,
    );
    expect(activeIdx).toBe(1);
  });

  it("should return no branch points for linear path", () => {
    useGameStore.getState().resetGame();
    useGameStore.getState().placeStone(3, 3);
    useGameStore.getState().placeStone(4, 4);
    useGameStore.getState().placeStone(5, 5);

    const tree = useGameStore.getState().gameTree;
    const currentNode = useGameStore.getState().currentNode;
    const path = getPathToNode(tree, currentNode.id);
    expect(path).not.toBeNull();

    const branchPoints = path!
      .slice(0, -1)
      .filter((node) => node.children.length > 1);
    expect(branchPoints.length).toBe(0);
  });
});
