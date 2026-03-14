const { produce } = require("immer");

const obj = { id: 1, val: 0, children: [] };
const state = { tree: obj, current: obj };

const getNode = (root, id) => {
  if (root.id === id) return root;
  for (let c of root.children) {
    let f = getNode(c, id);
    if (f) return f;
  }
  return null;
}

let nextState = produce(state, draft => {
  let node = getNode(draft.tree, draft.current.id);
  node.val = 1;
  draft.current = node; // re-link
});

console.log(nextState.tree.val, nextState.current.val);
console.log(nextState.tree === nextState.current);

nextState = produce(nextState, draft => {
  let current = getNode(draft.tree, draft.current.id);
  let child = { id: 2, val: 2, children: [] };
  current.children.push(child);
  draft.current = child;
});

console.log(nextState.tree.children[0].val, nextState.current.val);
console.log(nextState.tree.children[0] === nextState.current);
