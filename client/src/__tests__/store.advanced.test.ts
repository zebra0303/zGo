import { describe, it, expect, beforeEach } from "vitest";
import {
  useGameStore,
  getPathToNode,
  getNode,
} from "@/entities/match/model/store";

beforeEach(() => {
  useGameStore.getState().resetGame();
});

describe("Game Store — Pass & Resign", () => {
  it("should handle pass and switch player", () => {
    useGameStore.getState().passTurn();
    const state = useGameStore.getState();

    expect(state.currentPlayer).toBe("WHITE");
    expect(state.consecutivePasses).toBe(1);
    expect(state.currentNode.x).toBe(null);
    expect(state.currentNode.y).toBe(null);
  });

  it("should end game after two consecutive passes", () => {
    useGameStore.getState().passTurn();
    useGameStore.getState().passTurn();
    const state = useGameStore.getState();

    expect(state.isGameOver).toBe(true);
    expect(state.consecutivePasses).toBe(2);
  });

  it("should reset consecutive passes after a stone placement", () => {
    useGameStore.getState().passTurn();
    expect(useGameStore.getState().consecutivePasses).toBe(1);

    useGameStore.getState().placeStone(3, 3);
    expect(useGameStore.getState().consecutivePasses).toBe(0);
  });

  it("should set game over on resign", () => {
    useGameStore.getState().resignGame();
    const state = useGameStore.getState();

    expect(state.isGameOver).toBe(true);
    expect(state.showDeadStones).toBe(true);
  });
});

describe("Game Store — Undo Move", () => {
  it("should undo 2 moves back (PvAI pattern)", () => {
    // Simulate: human (3,3) → AI (4,4) → human (5,5) → AI (6,6)
    useGameStore.getState().placeStone(3, 3); // move 1 (BLACK)
    useGameStore.getState().placeStone(4, 4); // move 2 (WHITE)
    useGameStore.getState().placeStone(5, 5); // move 3 (BLACK)
    useGameStore.getState().placeStone(6, 6); // move 4 (WHITE)

    expect(useGameStore.getState().currentNode.moveIndex).toBe(4);

    useGameStore.getState().undoMove();
    const state = useGameStore.getState();

    // Should go back 2 moves (to move 2)
    expect(state.currentNode.moveIndex).toBe(2);
    expect(state.undoUsedInGame).toBe(true);
    expect(state.board[5][5]).toBe(null); // move 3 undone
    expect(state.board[6][6]).toBe(null); // move 4 undone
  });

  it("should not allow undo twice in same game", () => {
    useGameStore.getState().placeStone(3, 3);
    useGameStore.getState().placeStone(4, 4);
    useGameStore.getState().placeStone(5, 5);
    useGameStore.getState().placeStone(6, 6);

    useGameStore.getState().undoMove();
    expect(useGameStore.getState().currentNode.moveIndex).toBe(2);

    // Second undo should be blocked
    useGameStore.getState().placeStone(7, 7);
    useGameStore.getState().placeStone(8, 8);
    useGameStore.getState().undoMove();
    // moveIndex should NOT change because undoUsedInGame is true
    expect(useGameStore.getState().currentNode.moveIndex).toBe(4);
  });

  it("should not undo if less than 3 moves played", () => {
    useGameStore.getState().placeStone(3, 3);

    const moveIndexBefore = useGameStore.getState().currentNode.moveIndex;
    useGameStore.getState().undoMove();
    // With only 1 move, path.length < 3 so undo is a no-op
    expect(useGameStore.getState().currentNode.moveIndex).toBe(moveIndexBefore);
  });

  it("should reset undoUsedInGame on resetGame", () => {
    useGameStore.getState().placeStone(3, 3);
    useGameStore.getState().placeStone(4, 4);
    useGameStore.getState().placeStone(5, 5);
    useGameStore.getState().placeStone(6, 6);
    useGameStore.getState().undoMove();
    expect(useGameStore.getState().undoUsedInGame).toBe(true);

    useGameStore.getState().resetGame();
    expect(useGameStore.getState().undoUsedInGame).toBe(false);
  });
});

describe("Game Store — Navigation (setMoveIndex & setCurrentNode)", () => {
  it("should navigate to specific move index", () => {
    useGameStore.getState().placeStone(3, 3); // 1
    useGameStore.getState().placeStone(4, 4); // 2
    useGameStore.getState().placeStone(5, 5); // 3
    useGameStore.getState().placeStone(6, 6); // 4

    useGameStore.getState().setMoveIndex(2);
    expect(useGameStore.getState().currentNode.moveIndex).toBe(2);
    expect(useGameStore.getState().board[4][4]).toBe("WHITE");
    expect(useGameStore.getState().board[5][5]).toBe(null);

    useGameStore.getState().setMoveIndex(0);
    expect(useGameStore.getState().currentNode.id).toBe("root");
  });

  it("should clamp setMoveIndex to available moves", () => {
    useGameStore.getState().placeStone(3, 3);
    useGameStore.getState().placeStone(4, 4);

    useGameStore.getState().setMoveIndex(100); // beyond available
    expect(useGameStore.getState().currentNode.moveIndex).toBe(2);
  });

  it("should navigate to specific node by id", () => {
    useGameStore.getState().placeStone(3, 3);
    const firstMoveId = useGameStore.getState().currentNode.id;
    useGameStore.getState().placeStone(4, 4);
    useGameStore.getState().placeStone(5, 5);

    useGameStore.getState().setCurrentNode(firstMoveId);
    expect(useGameStore.getState().currentNode.id).toBe(firstMoveId);
    expect(useGameStore.getState().currentNode.moveIndex).toBe(1);
  });
});

describe("Game Store — loadMatch", () => {
  it("should rebuild game tree from moves", () => {
    const moves = [null, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 }];

    useGameStore.getState().loadMatch(moves, undefined, undefined, 19, 0);
    const state = useGameStore.getState();

    expect(state.isReviewMode).toBe(true);
    expect(state.currentNode.moveIndex).toBe(3);
    expect(state.board[3][3]).toBe("BLACK");
    expect(state.board[4][4]).toBe("WHITE");
    expect(state.board[5][5]).toBe("BLACK");
  });

  it("should apply win rates to nodes", () => {
    const moves = [null, { x: 3, y: 3 }, { x: 4, y: 4 }];
    const winRates = [50, 55, 45];

    useGameStore.getState().loadMatch(moves, winRates, undefined, 19, 0);
    const state = useGameStore.getState();
    const tree = state.gameTree;

    expect(tree.winRate).toBe(50); // root
    expect(tree.children[0].winRate).toBe(55); // move 1
    expect(tree.children[0].children[0].winRate).toBe(45); // move 2
  });

  it("should default win rates to 50 when not provided", () => {
    const moves = [null, { x: 3, y: 3 }];
    useGameStore.getState().loadMatch(moves, undefined, undefined, 19, 0);
    const tree = useGameStore.getState().gameTree;

    expect(tree.children[0].winRate).toBe(50);
  });

  it("should load match with different board sizes", () => {
    const moves = [null, { x: 2, y: 2 }];
    useGameStore.getState().loadMatch(moves, undefined, undefined, 9, 0);
    const state = useGameStore.getState();

    expect(state.boardSize).toBe(9);
    expect(state.board.length).toBe(9);
    expect(state.board[0].length).toBe(9);
  });

  it("should store reviewChat when provided", () => {
    const moves = [null, { x: 3, y: 3 }];
    const chat = {
      chat: [
        { sender: "host", message: "hi", createdAt: "2026-01-01T00:00:00Z" },
      ],
      hostNickname: "Player1",
      guestNickname: "Player2",
    };

    useGameStore
      .getState()
      .loadMatch(moves, undefined, undefined, 19, 0, null, chat);
    const state = useGameStore.getState();

    expect(state.reviewChat).not.toBeNull();
    expect(state.reviewChat?.chat.length).toBe(1);
    expect(state.reviewChat?.hostNickname).toBe("Player1");
  });

  it("should clear reviewChat on resetGame", () => {
    const moves = [null, { x: 3, y: 3 }];
    const chat = {
      chat: [
        { sender: "host", message: "hi", createdAt: "2026-01-01T00:00:00Z" },
      ],
    };
    useGameStore
      .getState()
      .loadMatch(moves, undefined, undefined, 19, 0, null, chat);
    expect(useGameStore.getState().reviewChat).not.toBeNull();

    useGameStore.getState().resetGame();
    expect(useGameStore.getState().reviewChat).toBeNull();
  });

  it("should handle handicap correctly in loadMatch", () => {
    // With handicap, WHITE moves first
    const moves = [null, { x: 3, y: 3 }, { x: 4, y: 4 }];
    useGameStore.getState().loadMatch(moves, undefined, undefined, 19, 2);
    const state = useGameStore.getState();

    // Move 1 should be WHITE (handicap: even index = WHITE)
    expect(state.gameTree.children[0].color).toBe("WHITE");
    // Move 2 should be BLACK
    expect(state.gameTree.children[0].children[0].color).toBe("BLACK");
  });
});

describe("Game Store — updateWinRate & updateWinRates", () => {
  it("should update win rate for a specific node", () => {
    useGameStore.getState().placeStone(3, 3);
    const nodeId = useGameStore.getState().currentNode.id;

    useGameStore.getState().updateWinRate(nodeId, 65);
    const node = getNode(useGameStore.getState().gameTree, nodeId);
    expect(node?.winRate).toBe(65);
  });

  it("should batch update win rates", () => {
    useGameStore.getState().placeStone(3, 3);
    const node1Id = useGameStore.getState().currentNode.id;
    useGameStore.getState().placeStone(4, 4);
    const node2Id = useGameStore.getState().currentNode.id;

    useGameStore.getState().updateWinRates([
      { nodeId: node1Id, winRate: 60 },
      { nodeId: node2Id, winRate: 40 },
    ]);

    const tree = useGameStore.getState().gameTree;
    expect(getNode(tree, node1Id)?.winRate).toBe(60);
    expect(getNode(tree, node2Id)?.winRate).toBe(40);
  });
});

describe("Game Store — getPathToNode", () => {
  it("should return path from root to target node", () => {
    useGameStore.getState().placeStone(3, 3);
    useGameStore.getState().placeStone(4, 4);
    useGameStore.getState().placeStone(5, 5);

    const tree = useGameStore.getState().gameTree;
    const currentNode = useGameStore.getState().currentNode;
    const path = getPathToNode(tree, currentNode.id);

    expect(path).not.toBeNull();
    expect(path!.length).toBe(4); // root + 3 moves
    expect(path![0].id).toBe("root");
    expect(path![3].id).toBe(currentNode.id);
  });

  it("should return null for non-existent node", () => {
    const tree = useGameStore.getState().gameTree;
    expect(getPathToNode(tree, "nonexistent")).toBeNull();
  });

  it("should return correct path for variation branch", () => {
    useGameStore.getState().placeStone(3, 3); // main
    useGameStore.getState().goToPreviousMove(); // back to root
    useGameStore.getState().placeStone(10, 10); // variation

    const tree = useGameStore.getState().gameTree;
    const currentNode = useGameStore.getState().currentNode;
    const path = getPathToNode(tree, currentNode.id);

    expect(path!.length).toBe(2); // root + variation move
    expect(path![1].x).toBe(10);
    expect(path![1].y).toBe(10);
  });
});

describe("Game Store — Handicap", () => {
  it("should set WHITE as first player when handicap > 0", () => {
    useGameStore.getState().setGameConfig({ handicap: 2, boardSize: 19 });
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().currentPlayer).toBe("WHITE");
  });

  it("should place handicap stones on the board", () => {
    useGameStore.getState().setGameConfig({ handicap: 2, boardSize: 19 });
    useGameStore.getState().resetGame();
    const board = useGameStore.getState().board;

    // 2-stone handicap should place black stones at standard positions
    const blackStones = board
      .flatMap((row, y) =>
        row.map((cell, x) => (cell === "BLACK" ? { x, y } : null)),
      )
      .filter(Boolean);
    expect(blackStones.length).toBe(2);
  });
});

describe("Game Store — Game Config", () => {
  it("should update game configuration", () => {
    useGameStore.getState().setGameConfig({
      boardSize: 9,
      aiDifficulty: 5,
      soundEnabled: false,
      boardScale: 1.5,
    });
    const state = useGameStore.getState();

    expect(state.boardSize).toBe(9);
    expect(state.aiDifficulty).toBe(5);
    expect(state.soundEnabled).toBe(false);
    expect(state.boardScale).toBe(1.5);
  });

  it("should reset handicap when board size <= 9", () => {
    useGameStore.getState().setGameConfig({ handicap: 4, boardSize: 19 });
    expect(useGameStore.getState().handicap).toBe(4);

    useGameStore.getState().setGameConfig({ boardSize: 9 });
    expect(useGameStore.getState().handicap).toBe(0);
  });
});
