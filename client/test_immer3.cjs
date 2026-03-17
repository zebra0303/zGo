const { produce } = require("immer");

const state = {
  tree: { id: "root", val: 50, children: [] },
};
state.current = state.tree;

const getNode = (root, id) => {
  if (root.id === id) return root;
  for (const c of root.children) {
    const f = getNode(c, id);
    if (f) return f;
  }
  return null;
};

let nextState = produce(state, (draft) => {
  draft.tree.val = 55;
  const child = { id: "c1", val: 50, children: [] };
  let currentInTree = getNode(draft.tree, draft.current.id);
  currentInTree.children.push(child);
  draft.current = child;
});

nextState = produce(nextState, (draft) => {
  const child = { id: "c2", val: 50, children: [] };
  let currentInTree = getNode(draft.tree, draft.current.id);
  currentInTree.children.push(child);
  draft.current = child;
});

console.log("Before update:", nextState.tree.children[0].children[0].val);

nextState = produce(nextState, (draft) => {
  let currentInTree = getNode(draft.tree, draft.current.id);
  currentInTree.val = 80;
  draft.current = currentInTree;
});

console.log(
  "After update node.val:",
  nextState.tree.children[0].children[0].val,
);
console.log("After update current.val:", nextState.current.val);
