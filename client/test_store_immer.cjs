const { createStore } = require("zustand/vanilla");
const { produce } = require("immer");

const createInitialNode = () => {
  return { id: "root", winRate: 50, children: [] };
};

const getNode = (root, id) => {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = getNode(child, id);
    if (found) return found;
  }
  return null;
};

const store = createStore((set, get) => ({
  gameTree: createInitialNode(),
  currentNode: createInitialNode(),
  placeStone: (id) => {
    set(produce(draft => {
      const currentInTree = getNode(draft.gameTree, draft.currentNode.id);
      const newNode = { id, winRate: 50, children: [] };
      currentInTree.children.push(newNode);
      draft.currentNode = currentInTree.children[currentInTree.children.length - 1];
    }));
  },
  updateWinRate: (id, winRate) => {
    set(produce(draft => {
      const node = getNode(draft.gameTree, id);
      if (node) node.winRate = winRate;
      draft.currentNode = getNode(draft.gameTree, draft.currentNode.id);
    }));
  }
}));

// Simulate what happened
store.setState({ gameTree: createInitialNode() });
store.setState({ currentNode: store.getState().gameTree });

store.getState().placeStone("move1");
console.log("After placeStone:", store.getState().currentNode.id, store.getState().currentNode.winRate);

store.getState().updateWinRate("move1", 80);
console.log("After updateWinRate:", store.getState().currentNode.id, store.getState().currentNode.winRate);
console.log("Tree winRate:", store.getState().gameTree.children[0].winRate);

store.getState().placeStone("move2");
console.log("After placeStone 2:", store.getState().currentNode.id, store.getState().currentNode.winRate);

store.getState().updateWinRate("move2", 90);
console.log("After updateWinRate 2:", store.getState().currentNode.id, store.getState().currentNode.winRate);
console.log("Tree winRate 2:", store.getState().gameTree.children[0].children[0].winRate);
