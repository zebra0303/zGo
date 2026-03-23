const { produce } = require("immer");

const obj = { id: 1, val: 0 };
const state = { tree: obj, current: obj };

const nextState = produce(state, (draft) => {
  draft.tree.val = 1;
});

console.log(nextState.tree.val, nextState.current.val);
