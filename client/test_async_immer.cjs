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
      const newNode = { id, winRate: currentInTree.winRate, children: [] };
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

store.setState({ gameTree: createInitialNode() });
store.setState({ currentNode: store.getState().gameTree });

async function run() {
  // Move 1
  store.getState().placeStone("move1");
  const nodeId1 = store.getState().currentNode.id;
  
  // Simulate AI fetching delay
  await new Promise(r => setTimeout(r, 100));
  
  // Teacher Advice returns for move 1
  store.getState().updateWinRate(nodeId1, 80);
  
  // Move 2
  store.getState().placeStone("move2");
  const nodeId2 = store.getState().currentNode.id;
  
  // AI fetching delay
  await new Promise(r => setTimeout(r, 100));
  
  // Teacher Advice returns for move 2
  store.getState().updateWinRate(nodeId2, 90);

  // Extract winrates just like handleSaveMatch
  const winRates = [50];
  let tempCurr = store.getState().currentNode;
  const reversed = [];
  while (tempCurr && tempCurr.id !== "root") {
    reversed.unshift(tempCurr.winRate);
    // tempCurr.parent is not set in this mock, so let's mock the extraction by traversing from root
    break; 
  }
  
  console.log("Root:", store.getState().gameTree.winRate);
  console.log("Move1:", store.getState().gameTree.children[0].winRate);
  console.log("Move2:", store.getState().gameTree.children[0].children[0].winRate);
}

run();
