import { HistoryNode } from "@/entities/match/model/types";
import { PlayerColor, BoardState } from "@/shared/types/board";
import { applyMove } from "@/entities/board/lib/goLogic";
import { setupInitialBoard } from "@/entities/match/lib/boardUtils";

export interface FlatNode {
  id: string;
  x: number | null;
  y: number | null;
  color: PlayerColor | null;
  capturedByBlack: number;
  capturedByWhite: number;
  winRate: number;
  childrenIds: string[];
  parentId: string | null;
  moveIndex: number;
  // Legacy: board field may exist in older persisted data
  board?: BoardState;
}

export const flattenTree = (root: HistoryNode): FlatNode[] => {
  const flattened: FlatNode[] = [];
  const stack: HistoryNode[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    flattened.push({
      id: node.id,
      x: node.x,
      y: node.y,
      color: node.color,
      // board excluded to reduce localStorage size (~100x reduction)
      capturedByBlack: node.capturedByBlack,
      capturedByWhite: node.capturedByWhite,
      winRate: node.winRate,
      childrenIds: node.children.map((c) => c.id),
      parentId: node.parent?.id ?? null,
      moveIndex: node.moveIndex,
    });
    stack.push(...node.children);
  }

  return flattened;
};

// Replay moves from root to rebuild board states after deserialization
const replayBoards = (
  node: HistoryNode,
  boardSize: number,
  handicap: number,
) => {
  for (const child of node.children) {
    if (child.x !== null && child.y !== null && child.color) {
      const result = applyMove(node.board, child.x, child.y, child.color);
      child.board = result.newBoard;
    } else {
      // Pass move: inherit parent board
      child.board = node.board;
    }
    replayBoards(child, boardSize, handicap);
  }
};

export const reconstructTree = (
  nodes: FlatNode[],
  currentNodeId: string,
  boardSize: number = 19,
  handicap: number = 0,
): { root: HistoryNode; current: HistoryNode } => {
  const initialBoard = setupInitialBoard(boardSize, handicap);
  const nodeMap = new Map<string, HistoryNode>();

  // First pass: create all nodes without links or boards
  nodes.forEach((fn) => {
    const isRoot = fn.id === "root";
    nodeMap.set(fn.id, {
      id: fn.id,
      x: fn.x,
      y: fn.y,
      color: fn.color,
      // Root gets initial board; others get populated during replay
      board: isRoot ? initialBoard : ([] as unknown as BoardState),
      capturedByBlack: fn.capturedByBlack,
      capturedByWhite: fn.capturedByWhite,
      winRate: fn.winRate,
      children: [],
      parent: null,
      moveIndex: fn.moveIndex,
    });
  });

  // Second pass: establish links
  nodes.forEach((fn) => {
    const node = nodeMap.get(fn.id)!;
    if (fn.parentId) {
      node.parent = nodeMap.get(fn.parentId) || null;
    }
    fn.childrenIds.forEach((cid) => {
      const child = nodeMap.get(cid);
      if (child) node.children.push(child);
    });
  });

  const root = nodeMap.get("root")!;

  // Third pass: replay moves to rebuild board states
  replayBoards(root, boardSize, handicap);

  const current = nodeMap.get(currentNodeId) || root;

  return { root, current };
};
