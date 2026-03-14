import { HistoryNode } from "@/entities/match/model/store";
import { PlayerColor, BoardState } from "@/shared/types/board";

export interface FlatNode {
  id: string;
  x: number | null;
  y: number | null;
  color: PlayerColor | null;
  board: BoardState;
  capturedByBlack: number;
  capturedByWhite: number;
  winRate: number;
  childrenIds: string[];
  parentId: string | null;
  moveIndex: number;
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
      board: node.board,
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

export const reconstructTree = (
  nodes: FlatNode[],
  currentNodeId: string,
): { root: HistoryNode; current: HistoryNode } => {
  const nodeMap = new Map<string, HistoryNode>();

  // First pass: create all nodes without links
  nodes.forEach((fn) => {
    nodeMap.set(fn.id, {
      id: fn.id,
      x: fn.x,
      y: fn.y,
      color: fn.color,
      board: fn.board,
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
  const current = nodeMap.get(currentNodeId) || root;

  return { root, current };
};
