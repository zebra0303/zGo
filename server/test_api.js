async function test() {
  const board = Array(19)
    .fill(null)
    .map(() => Array(19).fill(null));
  const response = await fetch("http://localhost:3001/api/ai/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      board,
      currentPlayer: "BLACK",
      isHintRequest: false,
    }),
  });
  const data = await response.json();
  console.log(data);
}
test();
