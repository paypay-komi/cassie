const Connect4Game = require("./Connect4Game");

class Connect4AI {
    getMove(game, aiPlayer, opponent) {
        const best = [];
        let bestVal = -Infinity;

        for (const col of game.getValidMoves()) {
            const row = game.drop(col, aiPlayer);
            if (row === null) continue;
            const val = this.#minimax(game, 0, false, aiPlayer, opponent, -Infinity, Infinity);
            game.undo(col, row);

            if (val > bestVal) {
                bestVal = val;
                best.length = 0;
                best.push(col);
            } else if (val === bestVal) {
                best.push(col);
            }
        }

        return best[Math.floor(Math.random() * best.length)] ?? -1;
    }

    #minimax(game, depth, isMax, aiPlayer, opponent, alpha, beta) {
        if (this.#checkWinner(game, aiPlayer)) return 10 - depth;
        if (this.#checkWinner(game, opponent)) return depth - 10;

        if (depth >= 7) return 0;

        const validMoves = game.getValidMoves();
        if (validMoves.length === 0) return 0;

        const currentPlayer = isMax ? aiPlayer : opponent;

        if (isMax) {
            let best = -Infinity;
            for (const col of validMoves) {
                const row = game.drop(col, currentPlayer);
                if (row === null) continue;
                best = Math.max(best, this.#minimax(game, depth + 1, false, aiPlayer, opponent, alpha, beta));
                game.undo(col, row);
                alpha = Math.max(alpha, best);
                if (beta <= alpha) break;
            }
            return best;
        } else {
            let best = Infinity;
            for (const col of validMoves) {
                const row = game.drop(col, currentPlayer);
                if (row === null) continue;
                best = Math.min(best, this.#minimax(game, depth + 1, true, aiPlayer, opponent, alpha, beta));
                game.undo(col, row);
                beta = Math.min(beta, best);
                if (beta <= alpha) break;
            }
            return best;
        }
    }

    #checkWinner(game, player) {
        const board = game.board;
        for (let row = 0; row < Connect4Game.ROWS; row++) {
            for (let col = 0; col < Connect4Game.COLS; col++) {
                if (board[row][col] !== player) continue;

                if (col + 3 < Connect4Game.COLS &&
                    board[row][col + 1] === player &&
                    board[row][col + 2] === player &&
                    board[row][col + 3] === player) return true;

                if (row + 3 < Connect4Game.ROWS &&
                    board[row + 1][col] === player &&
                    board[row + 2][col] === player &&
                    board[row + 3][col] === player) return true;

                if (row + 3 < Connect4Game.ROWS && col + 3 < Connect4Game.COLS &&
                    board[row + 1][col + 1] === player &&
                    board[row + 2][col + 2] === player &&
                    board[row + 3][col + 3] === player) return true;

                if (row + 3 < Connect4Game.ROWS && col - 3 >= 0 &&
                    board[row + 1][col - 1] === player &&
                    board[row + 2][col - 2] === player &&
                    board[row + 3][col - 3] === player) return true;
            }
        }
        return false;
    }
}

module.exports = Connect4AI;
