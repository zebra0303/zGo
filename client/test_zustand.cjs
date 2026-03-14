const { createStore } = require("zustand/vanilla");
const { persist, createJSONStorage } = require("zustand/middleware");
const { produce } = require("immer");

const getNode = (root, id) => {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = getNode(child, id);
    if (found) return found;
  }
  return null;
};

const store = createStore(
  persist(
    (set, get) => ({
      gameTree: { id: "root", winRate: 50, children: [] },
      currentNode: { id: "root", winRate: 50, children: [] },
      placeStone: (id) => {
        set(
          produce((draft) => {
            const currentInTree = getNode(draft.gameTree, draft.currentNode.id);
            const newNode = {
              id,
              winRate: currentInTree.winRate,
              children: [],
            };
            currentInTree.children.push(newNode);
            draft.currentNode = currentInTree.children[currentInTree.children.length - 1];
          })
        );
      },
      updateWinRate: (nodeId, winRate) => {
        set(
          produce((draft) => {
            const node = getNode(draft.gameTree, nodeId);
            if (node) {
              node.winRate = winRate;
            }
            draft.currentNode = getNode(draft.gameTree, draft.currentNode.id);
          })
        );
      },
    }),
    {
      name: "test-storage",
    }
  )
);

store.setState({
  gameTree: { id: "root", winRate: 50, children: [] },
});
store.setState({ currentNode: store.getState().gameTree });

store.getState().placeStone("move1");
store.getState().updateWinRate("move1", 80);
store.getState().placeStone("move2");
store.getState().updateWinRate("move2", 90);

const { gameTree, currentNode } = store.getState();
console.log("Root:", gameTree.winRate);
console.log("Move1:", gameTree.children[0].winRate);
console.log("Move2:", gameTree.children[0].children[0].winRate);
console.log("Current:", currentNode.winRate);
