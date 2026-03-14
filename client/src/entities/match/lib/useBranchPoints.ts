import { useMemo } from "react";
import { useGameStore, getPathToNode } from "@/entities/match/model/store";

export interface BranchPoint {
  nodeId: string;
  moveIndex: number;
  variationCount: number;
  activeChildIndex: number;
  activeChildLabel: string; // "A", "B", "C"...
}

/**
 * Computes branch points along the ancestor path from root to currentNode.
 * Each branch point is a node with more than one child (variation).
 */
export const useBranchPoints = (): BranchPoint[] => {
  const { currentNode, gameTree } = useGameStore();

  return useMemo(() => {
    const path = getPathToNode(gameTree, currentNode.id);
    if (!path || path.length <= 1) return [];

    const result: BranchPoint[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const node = path[i];
      if (node.children.length > 1) {
        const nextInPath = path[i + 1];
        const activeChildIndex = node.children.findIndex(
          (c) => c.id === nextInPath.id,
        );
        result.push({
          nodeId: node.id,
          moveIndex: node.moveIndex,
          variationCount: node.children.length,
          activeChildIndex: activeChildIndex >= 0 ? activeChildIndex : 0,
          activeChildLabel: String.fromCharCode(
            65 + (activeChildIndex >= 0 ? activeChildIndex : 0),
          ),
        });
      }
    }

    return result;
  }, [gameTree, currentNode]);
};
