import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/entities/match/model/store";
import { flattenTree, reconstructTree } from "@/entities/match/lib/treeUtils";

beforeEach(() => {
  useGameStore.getState().resetGame();
});

describe("Tree Utils — flattenTree", () => {
  it("should flatten a single root node", () => {
    const tree = useGameStore.getState().gameTree;
    const flat = flattenTree(tree);

    expect(flat.length).toBe(1);
    expect(flat[0].id).toBe("root");
    expect(flat[0].parentId).toBe(null);
    expect(flat[0].childrenIds).toEqual([]);
  });

  it("should flatten a linear tree", () => {
    useGameStore.getState().placeStone(3, 3);
    useGameStore.getState().placeStone(4, 4);
    useGameStore.getState().placeStone(5, 5);

    const tree = useGameStore.getState().gameTree;
    const flat = flattenTree(tree);

    expect(flat.length).toBe(4); // root + 3 moves
    // Every node should have exactly one child except the last
    const root = flat.find((n) => n.id === "root")!;
    expect(root.childrenIds.length).toBe(1);
  });

  it("should flatten a tree with variations", () => {
    useGameStore.getState().placeStone(3, 3); // main line
    useGameStore.getState().goToPreviousMove(); // back to root
    useGameStore.getState().placeStone(10, 10); // variation

    const tree = useGameStore.getState().gameTree;
    const flat = flattenTree(tree);

    expect(flat.length).toBe(3); // root + 2 variations
    const root = flat.find((n) => n.id === "root")!;
    expect(root.childrenIds.length).toBe(2);
  });

  it("should not include board data in flattened nodes", () => {
    useGameStore.getState().placeStone(3, 3);
    const flat = flattenTree(useGameStore.getState().gameTree);

    // board should NOT be serialized (to save storage)
    flat.forEach((node) => {
      expect(node).not.toHaveProperty("board");
    });
  });

  it("should preserve win rates", () => {
    useGameStore.getState().placeStone(3, 3);
    const nodeId = useGameStore.getState().currentNode.id;
    useGameStore.getState().updateWinRate(nodeId, 72);

    const flat = flattenTree(useGameStore.getState().gameTree);
    const flatNode = flat.find((n) => n.id === nodeId)!;
    expect(flatNode.winRate).toBe(72);
  });
});

describe("Tree Utils — reconstructTree", () => {
  it("should reconstruct a linear tree with correct boards", () => {
    useGameStore.getState().placeStone(3, 3);
    useGameStore.getState().placeStone(4, 4);

    const tree = useGameStore.getState().gameTree;
    const currentId = useGameStore.getState().currentNode.id;
    const flat = flattenTree(tree);

    const { root, current } = reconstructTree(flat, currentId, 19, 0);

    expect(root.id).toBe("root");
    expect(root.children.length).toBe(1);
    expect(root.children[0].children.length).toBe(1);
    expect(current.id).toBe(currentId);

    // Board should be rebuilt via replay
    expect(root.children[0].board[3][3]).toBe("BLACK");
    expect(current.board[4][4]).toBe("WHITE");
  });

  it("should reconstruct a tree with variations", () => {
    useGameStore.getState().placeStone(3, 3);
    const mainId = useGameStore.getState().currentNode.id;
    useGameStore.getState().goToPreviousMove();
    useGameStore.getState().placeStone(10, 10);
    const varId = useGameStore.getState().currentNode.id;

    const flat = flattenTree(useGameStore.getState().gameTree);
    const { root } = reconstructTree(flat, varId, 19, 0);

    expect(root.children.length).toBe(2);
    // Both branches should have correct boards
    const mainBranch = root.children.find((c) => c.id === mainId)!;
    const varBranch = root.children.find((c) => c.id === varId)!;

    expect(mainBranch.board[3][3]).toBe("BLACK");
    expect(varBranch.board[10][10]).toBe("BLACK");
  });

  it("should preserve parent-child links", () => {
    useGameStore.getState().placeStone(3, 3);
    useGameStore.getState().placeStone(4, 4);

    const flat = flattenTree(useGameStore.getState().gameTree);
    const { root } = reconstructTree(
      flat,
      useGameStore.getState().currentNode.id,
      19,
      0,
    );

    const child1 = root.children[0];
    const child2 = child1.children[0];

    expect(child1.parent).toBe(root);
    expect(child2.parent).toBe(child1);
  });

  it("should fall back to root when currentNodeId not found", () => {
    useGameStore.getState().placeStone(3, 3);
    const flat = flattenTree(useGameStore.getState().gameTree);

    const { current } = reconstructTree(flat, "nonexistent", 19, 0);
    expect(current.id).toBe("root");
  });

  it("should work with 9x9 board", () => {
    useGameStore.getState().setGameConfig({ boardSize: 9 });
    useGameStore.getState().resetGame();
    useGameStore.getState().placeStone(4, 4);

    const flat = flattenTree(useGameStore.getState().gameTree);
    const { root } = reconstructTree(
      flat,
      useGameStore.getState().currentNode.id,
      9,
      0,
    );

    expect(root.board.length).toBe(9);
    expect(root.children[0].board[4][4]).toBe("BLACK");
  });
});

describe("Tree Utils — Round-trip (flatten → reconstruct)", () => {
  it("should produce identical game state after round-trip", () => {
    // Build a tree with a variation at root level (same pattern as store.test.ts)
    // root → (3,3) [main line]
    //      → (4,4) → (5,5) [variation branch]
    useGameStore.getState().placeStone(3, 3); // move 1
    useGameStore.getState().goToPreviousMove(); // back to root
    useGameStore.getState().placeStone(4, 4); // variation at move 1
    useGameStore.getState().placeStone(5, 5); // move 2 in variation

    const originalTree = useGameStore.getState().gameTree;
    const currentId = useGameStore.getState().currentNode.id;

    // Root should have 2 children
    expect(originalTree.children.length).toBe(2);

    const flat = flattenTree(originalTree);
    expect(flat.length).toBe(4); // root + (3,3) + (4,4) + (5,5)

    const { root, current } = reconstructTree(flat, currentId, 19, 0);

    // Same structure after round-trip
    expect(root.children.length).toBe(2);
    expect(current.id).toBe(currentId);
    expect(current.moveIndex).toBe(2);

    // Board state should be correctly rebuilt
    expect(current.board[4][4]).toBe("BLACK"); // move 1 in variation
    expect(current.board[5][5]).toBe("WHITE"); // move 2 in variation
    expect(current.board[3][3]).toBe(null); // other branch not taken
  });
});
