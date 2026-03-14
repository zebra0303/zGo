const { produce } = require("immer");

const root = { id: "root", val: 50, children: [], parent: null };
const child = { id: "child", val: 50, children: [], parent: root };
root.children.push(child);

const state = { tree: root, current: child };

const nextState = produce(state, draft => {
  draft.current.val = 80;
});

console.log("Tree root val:", nextState.tree.val);
console.log("Current val:", nextState.current.val);
console.log("Current parent val:", nextState.current.parent.val);
console.log("Are tree root and current parent the same object?", nextState.tree === nextState.current.parent);

const nextState2 = produce(nextState, draft => {
  draft.tree.val = 99;
});

console.log("After root update - Tree root val:", nextState2.tree.val);
console.log("After root update - Current parent val:", nextState2.current.parent.val);

