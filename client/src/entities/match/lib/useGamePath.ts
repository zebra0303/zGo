import { useMemo } from "react";
import {
  useGameStore,
  getPathToNode,
  HistoryNode,
} from "@/entities/match/model/store";

/**
 * Shared hook: builds the full main-branch path (ancestor + continuation)
 * from the current node. Used by ReviewControlWidget and WinRateGraphWidget.
 */
export const useGamePath = () => {
  const { currentNode, gameTree } = useGameStore();

  return useMemo(() => {
    const ancestorPath = getPathToNode(gameTree, currentNode.id) || [
      currentNode,
    ];

    // Walk down the main branch from currentNode
    const continuationPath: HistoryNode[] = [];
    let curr: HistoryNode | undefined = currentNode.children[0];
    while (curr) {
      continuationPath.push(curr);
      curr = curr.children[0];
    }

    const fullPath = [...ancestorPath, ...continuationPath];
    const currentIndexInPath = ancestorPath.length - 1;
    const totalMoves = Math.max(1, fullPath.length - 1);

    return { fullPath, currentIndexInPath, totalMoves };
  }, [gameTree, currentNode]);
};
