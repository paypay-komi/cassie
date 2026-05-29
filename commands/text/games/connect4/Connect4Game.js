class Connect4Game {
    static ROWS = 6;
    static COLS = 7;

    constructor() {
        this.board = Array.from({ length: Connect4Game.ROWS }, () => Array(Connect4Game.COLS).fill(null));
    }

    drop(col, player) {
        if (col < 0 || col >= Connect4Game.COLS) return null;
        if (this.board[0][col] !== null) return null;

        for (let row = Connect4Game.ROWS - 1; row >= 0; row--) {
            if (this.board[row][col] === null) {
                this.board[row][col] = player;
                return row;
            }
        }
        return null;
    }

    undo(col, row) {
        this.board[row][col] = null;
    }

    checkWin(row, col, player) {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            let count = 1;

            for (let i = 1; i < 4; i++) {
                const r = row + dr * i, c = col + dc * i;
                if (r < 0 || r >= Connect4Game.ROWS || c < 0 || c >= Connect4Game.COLS) break;
                if (this.board[r][c] !== player) break;
                count++;
            }

            for (let i = 1; i < 4; i++) {
                const r = row - dr * i, c = col - dc * i;
                if (r < 0 || r >= Connect4Game.ROWS || c < 0 || c >= Connect4Game.COLS) break;
                if (this.board[r][c] !== player) break;
                count++;
            }

            if (count >= 4) return true;
        }

        return false;
    }

    getValidMoves() {
        const moves = [];
        for (let col = 0; col < Connect4Game.COLS; col++) {
            if (this.board[0][col] === null) {
                moves.push(col);
            }
        }
        return moves;
    }

    isFull() {
        return this.getValidMoves().length === 0;
    }

    clone() {
        const g = new Connect4Game();
        g.board = this.board.map(r => [...r]);
        return g;
    }
}

module.exports = Connect4Game;
