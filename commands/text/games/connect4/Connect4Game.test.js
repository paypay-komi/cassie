const Connect4Game = require("./Connect4Game");

function assert(condition, msg) {
    if (!condition) throw new Error(`FAIL: ${msg}`);
    console.log(`PASS: ${msg}`);
}

const g = new Connect4Game();
assert(g.board.length === 6, "6 rows");
assert(g.board[0].length === 7, "7 cols");

let row = g.drop(3, "p1");
assert(row === 5, "drop goes to bottom row");
assert(g.board[5][3] === "p1", "piece placed at bottom");

row = g.drop(3, "p2");
assert(row === 4, "second drop stacks above");

g.board[0][3] = "x";
g.board[1][3] = "x";
g.board[2][3] = "x";
assert(g.drop(3, "p1") === null, "full column returns null");

const g3 = new Connect4Game();
g3.board[5] = [null, null, null, "p1", "p1", "p1", "p1"];
assert(g3.checkWin(5, 6, "p1") === true, "horizontal win");
assert(g3.checkWin(5, 0, "p2") === false, "no false positive");

const g4 = new Connect4Game();
g4.board[2][0] = "p2";
g4.board[3][0] = "p2";
g4.board[4][0] = "p2";
g4.board[5][0] = "p2";
assert(g4.checkWin(2, 0, "p2") === true, "vertical win");

const g5 = new Connect4Game();
g5.board[2][0] = "p1";
g5.board[3][1] = "p1";
g5.board[4][2] = "p1";
g5.board[5][3] = "p1";
assert(g5.checkWin(2, 0, "p1") === true, "diagonal \\ win");

const g6 = new Connect4Game();
g6.board[2][3] = "p2";
g6.board[3][2] = "p2";
g6.board[4][1] = "p2";
g6.board[5][0] = "p2";
assert(g6.checkWin(2, 3, "p2") === true, "diagonal / win");

const g7 = new Connect4Game();
g7.board[5][0] = "p1";
g7.undo(0, 5);
assert(g7.board[5][0] === null, "undo clears piece");

const g8 = new Connect4Game();
assert(g8.getValidMoves().length === 7, "all 7 cols valid initial");
g8.board[0][0] = "x";
assert(g8.getValidMoves().includes(0) === false, "full col excluded");
assert(g8.getValidMoves().length === 6, "6 valid after 1 col full");

const g9 = new Connect4Game();
for (let c = 0; c < 7; c++) {
    for (let r = 0; r < 6; r++) g9.board[r][c] = "x";
}
assert(g9.isFull() === true, "isFull detects full board");

const g10 = new Connect4Game();
g10.board[5][3] = "p1";
const clone = g10.clone();
assert(clone.board[5][3] === "p1", "clone copies state");
clone.board[5][4] = "p2";
assert(g10.board[5][4] === null, "clone independent");

console.log("\nAll tests passed!");
