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
  let currentInTree = getNode(draft.tree, draft.current.id);
  const child = { id: "c1", val: 50, children: [] };
  currentInTree.children.push(child);
  draft.current = child; // Set to the newly created object, which IS NOT attached to the draft proxy tree yet? Wait, it is pushed to currentInTree which is a proxy.
});

// Now update the child's value without re-linking
let nextState2 = produce(nextState, (draft) => {
  let node = getNode(draft.tree, draft.current.id);
  node.val = 99;
  // intentionally forget to re-link draft.current
});

console.log("Tree val:", nextState2.tree.children[0].val); // Should be 99
console.log("Current val:", nextState2.current.val); // Will it be 99 or 50?

// Now see if we update draft.current, does the tree update?
let nextState3 = produce(nextState2, (draft) => {
  draft.current.val = 100;
});
console.log(
  "Tree val after draft.current edit:",
  nextState3.tree.children[0].val,
); // Will it be 100 or 99?
console.log("Current val after draft.current edit:", nextState3.current.val); // Should be 100
