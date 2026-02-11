const { ActionRowBuilder, ButtonBuilder, ButtonStyle, Component, TextChannel } = require("discord.js");
const { act } = require("react");

class checkersGame {
    constructor(player1, player2, channel) {
        if (!player1 || !player2) throw new Error("Players not provided");
        this.player1 = player1;
        this.player2 = player2;
        this.currentPlayer = player1;
        this.gameOver = false;
        this.ai = !!player2.bot;
        this.gameid = `checkers.${player1.id}.${player2.id}`;
        this.channel = channel
        // Board constants
        this.EMPTY = 0; this.RED = 1; this.RED_KING = 2; this.BLACK = 3; this.BLACK_KING = 4;

        // Render constants
        this.darkSquare = '⬛'; this.lightSquare = '🟥';
        this.redPiece = '<:RedCheckersPiece:1469490262857351238>';
        this.blackPiece = '<:BlackCheckersPiece:1469490308784849174>';
        this.redKingPiece = '<:RedCheckersKing:1469490082829307904>';
        this.blackKingPiece = '<:BlackCheckersKing:1469490355610190009>';
        this.blankSquare = '<:blank:1469479742041231494>';
        this.renderMap = {
            [this.RED]: this.redPiece,
            [this.RED_KING]: this.redKingPiece,
            [this.BLACK]: this.blackPiece,
            [this.BLACK_KING]: this.blackKingPiece
        };
        this.activeCapturePiece = null;

        // Now build the board
        this.board = this.BuildBoard();

        // Only render after everything is initialized
        console.log('[DEBUG] Initial board built (render safe):\n' + this.renderBoard());
    }




    isPlayableSquare(row, col) {
        const playable = (row + col) % 2 === 1;
        console.log(`[DEBUG] Checking if square is playable at (${row}, ${col}): ${playable}`);
        return playable;
    }


    BuildBoard() {
        console.log('[DEBUG] Building initial board...');
        const board = [];
        const BLACK_ROWS = 3;
        const RED_ROWS = 3;

        for (let row = 0; row < 8; row++) {
            const currentRow = [];
            for (let col = 0; col < 8; col++) {
                if (this.isPlayableSquare(row, col)) {
                    if (row < BLACK_ROWS) {
                        currentRow.push(this.BLACK);
                        console.log(`[DEBUG] Placing BLACK piece at (${row}, ${col})`);
                    } else if (row >= 8 - RED_ROWS) {
                        currentRow.push(this.RED);
                        console.log(`[DEBUG] Placing RED piece at (${row}, ${col})`);
                    } else {
                        currentRow.push(this.EMPTY);
                        console.log(`[DEBUG] Empty playable square at (${row}, ${col})`);
                    }
                } else {
                    currentRow.push(this.EMPTY);
                    console.log(`[DEBUG] Dark square (non-playable) at (${row}, ${col})`);
                }
            }
            board.push(currentRow);
        }


        return board;
    }

    renderBoard() {
        const letters = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭'];
        const score = this.evaluateGameScore(this.currentPlayer);
        let boardString = `${score}\n${this.blankSquare}${letters.join('\u200B')}\n`;
        const rowNumbers = [':one:', ':two:', ':three:', ':four:', ':five:', ':six:', ':seven:', ':eight:'];

        for (let row = 0; row < 8; row++) {
            boardString += rowNumbers[row];
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];

                if (this.renderMap[piece]) {
                    boardString += this.renderMap[piece];
                } else if (this.isPlayableSquare(row, col)) {
                    boardString += this.lightSquare; // 🟥
                } else {
                    boardString += this.darkSquare;  // ⬛
                }
            }
            boardString += '\n';
        }

        console.log(`[DEBUG] Board rendered for ${this.currentPlayer.tag}:\n${boardString}`);
        return boardString;
    }

    makeMoveButtons(piece) {
        console.log(`[DEBUG] Generating move buttons for piece at ${this.convertNumberRowColToReadableRowCol(piece.row, piece.col)}`);

        const buttons = [];
        const validMoves = this.getValidMovesFromPiece(piece);

        console.log(`[DEBUG] Valid moves found: ${validMoves.map(m => this.convertNumberRowColToReadableRowCol(m.to.row, m.to.col)).join(', ')}`);

        for (const move of validMoves) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`${this.gameid}-move-${piece.row}-${piece.col}-${move.to.row}-${move.to.col}`)
                    .setLabel(`${this.convertNumberRowColToReadableRowCol(piece.row, piece.col)} → ${this.convertNumberRowColToReadableRowCol(move.to.row, move.to.col)}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }

        const cancelButton = new ButtonBuilder()
            .setCustomId(`${this.gameid}-cancel`)
            .setLabel('Cancel Selection')
            .setStyle(ButtonStyle.Danger);

        buttons.push(cancelButton);

        console.log(`[DEBUG] Total buttons created: ${buttons.length}`);
        return this.makeactionRows(buttons);
    }
    checkWin() {
        const player1Pieces = this.getplayerPiecesOnBoard(this.player1);
        const player2Pieces = this.getplayerPiecesOnBoard(this.player2);

        console.log(`[DEBUG] Player1 pieces count: ${player1Pieces.length}, Player2 pieces count: ${player2Pieces.length}`);

        if (player1Pieces.length === 0) {
            console.log('[DEBUG] Player1 has no pieces left. Player2 wins!');
            return this.player2;
        } else if (player2Pieces.length === 0) {
            console.log('[DEBUG] Player2 has no pieces left. Player1 wins!');
            return this.player1;
        }

        const player1Moves = this.getAllValidMoves(this.player1);
        const player2Moves = this.getAllValidMoves(this.player2);

        console.log(`[DEBUG] Player1 valid moves: ${player1Moves.length}, Player2 valid moves: ${player2Moves.length}`);

        if (player1Moves.length === 0) {
            console.log('[DEBUG] Player1 has no valid moves left. Player2 wins!');
            return this.player2;
        } else if (player2Moves.length === 0) {
            console.log('[DEBUG] Player2 has no valid moves left. Player1 wins!');
            return this.player1;
        }

        return null;
    }
    canCapture(row, col) {
        const piece = this.board[row][col];
        const directions = this.getDirectionForPiece({ piece });

        console.log(`[DEBUG] Checking capture for piece at ${row},${col} (value: ${piece})`);

        for (const dir of directions) {
            const newRow = row + dir.row;
            const newCol = col + dir.col;
            const jumpRow = newRow + dir.row;
            const jumpCol = newCol + dir.col;

            if (this.isInBounds(jumpRow, jumpCol)) {
                const targetPiece = this.board[newRow][newCol];
                const landingSpot = this.board[jumpRow][jumpCol];

                console.log(`[DEBUG] Direction row:${dir.row}, col:${dir.col} -> target at ${newRow},${newCol} (${targetPiece}), landing at ${jumpRow},${jumpCol} (${landingSpot})`);

                if (this.isOpponentPiece(targetPiece, piece) && landingSpot === this.EMPTY) {
                    console.log('[DEBUG] Capture possible!');
                    return true;
                }
            }
        }

        console.log('[DEBUG] No captures available for this piece.');
        return false;
    }

    evaluateGameScore(player) {
        const winner = this.checkWin();
        if (winner) {
            const resultScore = winner.id === player.id ? 1000 : -1000;
            console.log(`[DEBUG] Winner detected: ${winner.tag}, score for player ${player.tag}: ${resultScore}`);
            return resultScore;
        }

        const player1Pieces = this.getplayerPiecesOnBoard(this.player1);
        const player2Pieces = this.getplayerPiecesOnBoard(this.player2);

        const pieceScore = (piece, owner) => {
            const { row, col } = piece;
            const isKing = piece.piece === (owner === 'player1' ? this.RED_KING : this.BLACK_KING);
            const isRegular = piece.piece === (owner === 'player1' ? this.RED : this.BLACK);

            let score = isKing ? 2 : 1;

            if (isRegular) {
                score += owner === 'player1' ? (7 - row) * 0.2 : row * 0.2;
            }

            const centerRows = [3, 4], centerCols = [3, 4];
            if (centerRows.includes(row) && centerCols.includes(col)) score += 0.3;

            if (row === 0 || row === 7 || col === 0 || col === 7) score += 0.2;

            if (this.canCapture(piece.row, piece.col)) score += 1;

            console.log(`[DEBUG] Piece at ${row},${col} (${piece.piece}) owner ${owner} score: ${score}`);
            return score;
        };

        const player1Score = player1Pieces.reduce((sum, piece) => sum + pieceScore(piece, 'player1'), 0);
        const player2Score = player2Pieces.reduce((sum, piece) => sum + pieceScore(piece, 'player2'), 0);

        const finalScore = player.id === this.player1.id ? player1Score - player2Score : player2Score - player1Score;
        console.log(`[DEBUG] Game score for player ${player.tag}: ${finalScore} (P1: ${player1Score}, P2: ${player2Score})`);

        return finalScore;
    }

    minimax(depth, alpha, beta, isMaximizingPlayer, aiPlayer, activePiece = null) {
        const winner = this.checkWin();
        if (winner) {
            const resultScore = winner.id === aiPlayer.id ? 1000 : -1000;
            console.log(`[DEBUG] Depth ${depth}: Winner detected: ${winner.tag}, score: ${resultScore}`);
            return resultScore;
        }

        if (depth === 0) {
            const score = this.evaluateGameScore(aiPlayer);
            console.log(`[DEBUG] Depth 0: Evaluated score for ${aiPlayer.tag}: ${score}`);
            return score;
        }

        const currentPlayer = isMaximizingPlayer
            ? aiPlayer
            : (aiPlayer.id === this.player1.id ? this.player2 : this.player1);

        let moves = activePiece ? this.getValidMovesFromPiece(activePiece) : this.getAllValidMoves(currentPlayer);

        if (moves.length === 0) {
            const score = this.evaluateGameScore(aiPlayer);
            console.log(`[DEBUG] Depth ${depth}: No moves for ${currentPlayer.tag}, score: ${score}`);
            return score;
        }

        if (isMaximizingPlayer) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const simulatedGame = new checkersGame(this.player1, this.player2, this.channel);
                simulatedGame.board = this.board.map(row => row.slice());

                simulatedGame.makeMove(move);

                let nextActivePiece = null;
                if (move.capture) {
                    const pieceAfterMove = {
                        row: move.to.row,
                        col: move.to.col,
                        piece: simulatedGame.board[move.to.row][move.to.col]
                    };
                    const additionalCaptures = simulatedGame.getcamptureMovesFromPiece(pieceAfterMove);
                    if (additionalCaptures.length > 0) nextActivePiece = pieceAfterMove;
                }

                const evalScore = simulatedGame.minimax(
                    depth - 1,
                    alpha,
                    beta,
                    nextActivePiece ? true : false,
                    aiPlayer,
                    nextActivePiece
                );

                console.log(`[DEBUG] Depth ${depth}: Move ${this.convertNumberRowColToReadableRowCol(move.from.row, move.from.col)} → ${this.convertNumberRowColToReadableRowCol(move.to.row, move.to.col)} eval: ${evalScore}`);

                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) {
                    console.log(`[DEBUG] Depth ${depth}: Pruning remaining moves (alpha >= beta)`);
                    break;
                }
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const simulatedGame = new checkersGame(this.player1, this.player2, this.channel);
                simulatedGame.board = this.board.map(row => row.slice());

                simulatedGame.makeMove(move);

                let nextActivePiece = null;
                if (move.capture) {
                    const pieceAfterMove = {
                        row: move.to.row,
                        col: move.to.col,
                        piece: simulatedGame.board[move.to.row][move.to.col]
                    };
                    const additionalCaptures = simulatedGame.getcamptureMovesFromPiece(pieceAfterMove);
                    if (additionalCaptures.length > 0) nextActivePiece = pieceAfterMove;
                }

                const evalScore = simulatedGame.minimax(
                    depth - 1,
                    alpha,
                    beta,
                    nextActivePiece ? false : true,
                    aiPlayer,
                    nextActivePiece
                );

                console.log(`[DEBUG] Depth ${depth}: Opponent move ${this.convertNumberRowColToReadableRowCol(move.from.row, move.from.col)} → ${this.convertNumberRowColToReadableRowCol(move.to.row, move.to.col)} eval: ${evalScore}`);

                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) {
                    console.log(`[DEBUG] Depth ${depth}: Pruning remaining moves (beta <= alpha)`);
                    break;
                }
            }
            return minEval;
        }
    }


    getBestMove(depth, aiPlayer) {
        let bestScore = -Infinity;
        let bestMove = null;

        let moves = this.getAllValidMoves(aiPlayer);
        console.log(`[DEBUG] Evaluating ${moves.length} possible moves for ${aiPlayer.tag}`);

        for (const move of moves) {
            const simulatedGame = new checkersGame(this.player1, this.player2, this.channel);
            simulatedGame.board = this.board.map(row => row.slice());

            simulatedGame.makeMove(move);

            let nextActivePiece = null;
            if (move.capture) {
                const pieceAfterMove = {
                    row: move.to.row,
                    col: move.to.col,
                    piece: simulatedGame.board[move.to.row][move.to.col]
                };
                const additionalCaptures = simulatedGame.getcamptureMovesFromPiece(pieceAfterMove);
                if (additionalCaptures.length > 0) nextActivePiece = pieceAfterMove;
            }

            const score = simulatedGame.minimax(
                depth - 1,
                -Infinity,
                Infinity,
                nextActivePiece ? true : false,
                aiPlayer,
                nextActivePiece
            );

            console.log(`[DEBUG] Move ${this.convertNumberRowColToReadableRowCol(move.from.row, move.from.col)} → ${this.convertNumberRowColToReadableRowCol(move.to.row, move.to.col)} scored ${score}`);

            if (score > bestScore) {
                console.log(`[DEBUG] New best move found: ${this.convertNumberRowColToReadableRowCol(move.from.row, move.from.col)} → ${this.convertNumberRowColToReadableRowCol(move.to.row, move.to.col)} with score ${score}`);
                bestScore = score;
                bestMove = move;
            }
        }

        console.log(`[DEBUG] Best move selected: ${bestMove ? this.convertNumberRowColToReadableRowCol(bestMove.from.row, bestMove.from.col) + ' → ' + this.convertNumberRowColToReadableRowCol(bestMove.to.row, bestMove.to.col) : 'None'}`);
        return bestMove;
    }


    aimove() {
        console.log(`[DEBUG] AI (${this.player2.tag}) is starting its turn.`);

        let continueJump = true;
        let activePiece = null;

        while (continueJump) {
            // Get the best move using minimax, considering optional multi-jumps
            const move = this.getBestMove(2, this.player2);

            if (!move) {
                console.log('[DEBUG] AI has no moves left.');
                break; // No moves left
            }

            console.log(`[DEBUG] AI chooses move: ${this.convertNumberRowColToReadableRowCol(move.from.row, move.from.col)} → ${this.convertNumberRowColToReadableRowCol(move.to.row, move.to.col)}${move.capture ? ' (capture)' : ''}`);
            this.makeMove(move);

            // Check if the piece can optionally jump again
            const pieceAfterMove = {
                row: move.to.row,
                col: move.to.col,
                piece: this.board[move.to.row][move.to.col]
            };

            const additionalCaptures = this.getcamptureMovesFromPiece(pieceAfterMove);

            if (move.capture && additionalCaptures.length > 0) {
                // Decide optionally whether AI continues
                const currentScore = this.evaluateGameScore(this.player2);
                let bestContinueScore = currentScore;

                for (const nextMove of additionalCaptures) {
                    const simulatedGame = new checkersGame(this.player1, this.player2, this.channel);
                    simulatedGame.board = this.board.map(row => row.slice());
                    simulatedGame.makeMove(nextMove);

                    const score = simulatedGame.evaluateGameScore(this.player2);
                    console.log(`[DEBUG] AI considers continuing jump to ${this.convertNumberRowColToReadableRowCol(nextMove.to.row, nextMove.to.col)} with score ${score}`);
                    if (score > bestContinueScore) bestContinueScore = score;
                }

                if (bestContinueScore > currentScore) {
                    console.log('[DEBUG] AI decides to continue the jump.');
                    activePiece = pieceAfterMove;
                    continueJump = true;
                } else {
                    console.log('[DEBUG] AI decides to stop jumping.');
                    continueJump = false; // AI stops optional jump
                }
            } else {
                continueJump = false; // No more captures available
                console.log('[DEBUG] No more captures available for AI.');
            }
        }

        // Switch turn to the player
        this.currentPlayer = this.player1;
        console.log(`[DEBUG] AI turn ended. Now it's ${this.currentPlayer.tag}'s turn.`);
        this.gameMesage.edit({
            content: `Pick which piece ${this.currentPlayer}\n${this.renderBoard()}`,
            components: this.createPieceButtons(this.currentPlayer)
        });
    }

    async startGame() {
        console.log(`[DEBUG] Starting game between ${this.player1.tag} and ${this.player2.tag}`);

        this.gameMesage = await this.channel.send({
            content: `Game started between ${this.player1} and ${this.player2}!\n${this.renderBoard()}`,
            components: this.createPieceButtons(this.currentPlayer)
        });

        const filter = (interaction) => interaction.customId.startsWith(this.gameid);
        const collector = this.gameMesage.createMessageComponentCollector({ filter, idle: 120000 }); // 2 min idle

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== this.currentPlayer.id) {
                console.log(`[DEBUG] User ${interaction.user.tag} tried to act out of turn.`);
                return interaction.reply({ content: "🚫 It's not your turn!", ephemeral: true });
            }

            const [gameId, action, fr, fc, tr, tc] = interaction.customId.split('-');
            console.log(`[DEBUG] Interaction received: action=${action} from=${fr},${fc} to=${tr},${tc}`);
            const pieceValue = this.board[parseInt(fr)][parseInt(fc)];
            // --- 1️⃣ Player selects a piece ---
            if (action === 'selectPiece') {
                const selectedPiece = { row: parseInt(fr), col: parseInt(fc), piece: pieceValue };
                const validMoves = this.getValidMovesFromPiece(selectedPiece);
                console.log(`[DEBUG] Player selected piece at ${fr},${fc} with ${validMoves.length} valid moves`);

                if (validMoves.length === 0) {
                    return interaction.reply({ content: "🚫 No valid moves for this piece!", ephemeral: true });
                }

                await interaction.update({
                    content: `Selected piece at ${this.convertNumberRowColToReadableRowCol(selectedPiece.row, selectedPiece.col)}\n${this.renderBoard()}`,
                    components: this.makeMoveButtons(selectedPiece)
                });
            }

            // --- 2️⃣ Player makes a move ---
            if (action === 'move') {
                const fromRow = parseInt(fr, 10);
                const fromCol = parseInt(fc, 10);
                const toRow = parseInt(tr, 10);
                const toCol = parseInt(tc, 10);
                const pieceValue = this.board[fromRow][fromCol];

                const validMoves = this.getValidMovesFromPiece({ row: fromRow, col: fromCol, piece: pieceValue });
                const selectedMove = validMoves.find(m => m.to.row === toRow && m.to.col === toCol);

                if (!selectedMove) {
                    console.log(`[DEBUG] Invalid move attempted from ${fromRow},${fromCol} to ${toRow},${toCol}`);
                    return interaction.reply({ content: "🚫 Invalid move!", ephemeral: true });
                }

                console.log(`[DEBUG] Player ${this.currentPlayer.tag} makes move: ${fromRow},${fromCol} → ${toRow},${toCol}${selectedMove.capture ? ' (capture)' : ''}`);
                this.makeMove(selectedMove);

                // Handle optional multi-jumps
                if (selectedMove.capture) {
                    const pieceAfterMove = { row: toRow, col: toCol, piece: this.board[toRow][toCol] };
                    const additionalCaptures = this.getcamptureMovesFromPiece(pieceAfterMove);

                    if (additionalCaptures.length > 0) {
                        console.log(`[DEBUG] Player can optionally jump again with ${toRow},${toCol}`);
                        this.activeCapturePiece = pieceAfterMove;
                        return interaction.update({
                            content: `You captured! You can jump again with ${this.convertNumberRowColToReadableRowCol(toRow, toCol)} (or choose Done Jumping)\n${this.renderBoard()}`,
                            components: this.createPieceButtons(this.currentPlayer)
                        });
                    }
                }

                this.activeCapturePiece = null;

                // Switch turn
                this.currentPlayer = this.currentPlayer.id === this.player1.id ? this.player2 : this.player1;
                console.log(`[DEBUG] Turn switched. Current player: ${this.currentPlayer.tag}`);

                await interaction.update({
                    content: `Pick which piece ${this.currentPlayer}\n${this.renderBoard()}`,
                    components: this.createPieceButtons(this.currentPlayer)
                });

                // --- AI turn ---
                if (this.ai && this.currentPlayer.bot) {
                    console.log(`[DEBUG] AI (${this.player2.tag}) starting its turn...`);
                    await this.aimove();
                    console.log('[DEBUG] AI turn completed.');
                }
            }

            // --- Cancel selection ---
            if (action === 'cancel') {
                this.activeCapturePiece = null;
                console.log('[DEBUG] Player canceled selection.');
                await interaction.update({
                    content: `Pick which piece ${this.currentPlayer}\n${this.renderBoard()}`,
                    components: this.createPieceButtons(this.currentPlayer)
                });
            }

            // --- Done Jumping ---
            if (action === 'doneJump') {
                this.activeCapturePiece = null;
                this.currentPlayer = this.currentPlayer.id === this.player1.id ? this.player2 : this.player1;
                console.log(`[DEBUG] Player chose to stop jumping. Current player: ${this.currentPlayer.tag}`);
                await interaction.update({
                    content: `Pick which piece ${this.currentPlayer}\n${this.renderBoard()}`,
                    components: this.createPieceButtons(this.currentPlayer)
                });

                if (this.ai && this.currentPlayer.bot) {
                    console.log(`[DEBUG] AI starting optional jump turn...`);
                    await this.aimove();
                    console.log('[DEBUG] AI optional jump completed.');
                }
            }

            // --- Check for win ---
            const winner = this.checkWin();
            if (winner) {
                this.gameOver = true;
                collector.stop('gameOver');
                console.log(`[DEBUG] Game over! Winner: ${winner.tag}`);
                return this.gameMesage.reply(`Game over! ${winner} wins!`);
            }
        });

        collector.on('end', async () => {
            console.log('[DEBUG] Collector ended, disabling buttons.');
            const disabledComponents = this.gameMesage.components.map(row => {
                const newRow = new ActionRowBuilder();
                row.components.forEach(component => {
                    if (component.data?.type === 2) { // Button
                        const button = ButtonBuilder.from(component).setDisabled(true);
                        newRow.addComponents(button);
                    }
                });
                return newRow;
            });

            await this.gameMesage.edit({ components: disabledComponents });

            if (!this.gameOver) {
                console.log('[DEBUG] Game ended due to inactivity.');
                this.gameMesage.reply('Game ended due to inactivity.');
            }
        });
    }

    makeMove(move) {
        const piece = this.board[move.from.row][move.from.col];
        console.log(`[DEBUG] Moving piece ${piece} from (${move.from.row},${move.from.col}) to (${move.to.row},${move.to.col})`);

        // Move the piece
        this.board[move.to.row][move.to.col] = piece;
        this.board[move.from.row][move.from.col] = this.EMPTY;

        // Handle capture
        if (move.capture) {
            this.board[move.capture.row][move.capture.col] = this.EMPTY;
            console.log(`[DEBUG] Captured piece at (${move.capture.row},${move.capture.col})`);
        }

        // Handle promotion to king
        if (piece === this.RED && move.to.row === 0) {
            this.board[move.to.row][move.to.col] = this.RED_KING;
            console.log(`[DEBUG] RED piece promoted to RED_KING at (${move.to.row},${move.to.col})`);
        }
        if (piece === this.BLACK && move.to.row === 7) {
            this.board[move.to.row][move.to.col] = this.BLACK_KING;
            console.log(`[DEBUG] BLACK piece promoted to BLACK_KING at (${move.to.row},${move.to.col})`);
        }
    }


    getplayerPieces(player) {
        if (player.id === this.player1.id) {
            return [this.RED, this.RED_KING];
        } else {
            return [this.BLACK, this.BLACK_KING];
        }
    }

    isInBounds(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    isOpponentPiece(pieceValue, currentPieceValue) {
        const redPieces = [this.RED, this.RED_KING];
        const blackPieces = [this.BLACK, this.BLACK_KING];

        return (
            (redPieces.includes(currentPieceValue) && blackPieces.includes(pieceValue)) ||
            (blackPieces.includes(currentPieceValue) && redPieces.includes(pieceValue))
        );
    }

    getplayerPiecesOnBoard(player) {
        const pieces = this.getplayerPieces(player);
        const playerPieces = [];

        for (let row = 0; row < this.board.length; row++) {
            for (let col = 0; col < this.board[row].length; col++) {
                const piece = this.board[row][col];
                if (pieces.includes(piece)) {
                    const pieceObj = {};
                    pieceObj.row = row;
                    pieceObj.col = col;
                    pieceObj.piece = piece;
                    pieceObj.isKing = false;

                    if (piece === this.RED || piece === this.RED_KING) pieceObj.color = 'red';
                    if (piece === this.BLACK || piece === this.BLACK_KING) pieceObj.color = 'black';
                    if (piece === this.RED_KING || piece === this.BLACK_KING) pieceObj.isKing = true;

                    playerPieces.push(pieceObj);
                }
            }
        }
        return playerPieces;
    }

    makeactionRows(buttons) {
        const actionRows = [];
        const maxButtonsPerRow = 5;

        for (let i = 0; i < buttons.length; i += maxButtonsPerRow) {
            const row = new ActionRowBuilder();
            row.addComponents(...buttons.slice(i, i + maxButtonsPerRow));
            actionRows.push(row);
        }
        return actionRows;
    }

    getDirectionForPiece(piece) {
        const dirs = [];

        if (piece.piece === this.RED) {
            dirs.push({ row: -1, col: -1 }, { row: -1, col: 1 });
        }

        if (piece.piece === this.BLACK) {
            dirs.push({ row: 1, col: -1 }, { row: 1, col: 1 });
        }

        if (piece.piece === this.RED_KING || piece.piece === this.BLACK_KING) {
            dirs.push(
                { row: -1, col: -1 }, { row: -1, col: 1 },
                { row: 1, col: -1 }, { row: 1, col: 1 }
            );
        }

        return dirs;
    }
    getcamptureMovesFromPiece(piece) {
        const captureMoves = [];
        const directions = this.getDirectionForPiece(piece);
        for (const dir of directions) {
            const newRow = piece.row + dir.row;
            const newCol = piece.col + dir.col;
            const jumpRow = newRow + dir.row;
            const jumpCol = newCol + dir.col;
            if (!this.isInBounds(jumpRow, jumpCol)) continue;

            const targetPiece = this.board[newRow][newCol];
            if (!this.isOpponentPiece(targetPiece, piece.piece)) continue;
            if (this.board[jumpRow][jumpCol] !== this.EMPTY) continue;
            captureMoves.push({
                from: { row: piece.row, col: piece.col },
                to: { row: jumpRow, col: jumpCol },
                capture: { row: newRow, col: newCol }
            });
        }
        return captureMoves;
    }
    getValidMovesFromPiece(piece) {
        const moves = [];
        const directions = this.getDirectionForPiece(piece);

        for (const dir of directions) {
            const newRow = piece.row + dir.row;
            const newCol = piece.col + dir.col;

            if (!this.isInBounds(newRow, newCol)) continue;

            if (this.board[newRow][newCol] === this.EMPTY) {
                moves.push({
                    from: { row: piece.row, col: piece.col },
                    to: { row: newRow, col: newCol }
                });
            }

            const jumpRow = newRow + dir.row;
            const jumpCol = newCol + dir.col;

            if (!this.isInBounds(jumpRow, jumpCol)) continue;

            const targetPiece = this.board[newRow][newCol];

            if (!this.isOpponentPiece(targetPiece, piece.piece)) continue;
            if (this.board[jumpRow][jumpCol] !== this.EMPTY) continue;

            moves.push({
                from: { row: piece.row, col: piece.col },
                to: { row: jumpRow, col: jumpCol },
                capture: { row: newRow, col: newCol }
            });
        }
        return moves;
    }

    getAllValidMoves(player) {
        const playerPieces = this.getplayerPiecesOnBoard(player);
        let allMoves = [];
        for (const piece of playerPieces) {
            allMoves = allMoves.concat(this.getValidMovesFromPiece(piece));
        }
        return allMoves;
    }

    convertNumberRowColToReadableRowCol(row, col) {
        const columns = Array.from({ length: 8 }, (_, i) => String.fromCharCode(65 + i));
        return `${columns[col]}${row + 1}`;
    }

    createPieceButtons(player) {
        let pieces;
        if (this.activeCapturePiece) {
            // Only show the piece that just captured
            pieces = [this.activeCapturePiece];
        } else {
            pieces = this.getplayerPiecesOnBoard(player);
        }

        const buttons = pieces.map(piece => {
            let label = piece.isKing ? 'King' : 'Piece';
            label += ` at ${this.convertNumberRowColToReadableRowCol(piece.row, piece.col)}`;

            return new ButtonBuilder()
                .setCustomId(`${this.gameid}-selectPiece-${piece.row}-${piece.col}-${piece.piece}`)
                .setLabel(label)
                .setStyle(ButtonStyle.Primary);
        });

        // If a multi-jump is possible, add optional "Done Jumping" button
        if (this.activeCapturePiece) {
            const doneButton = new ButtonBuilder()
                .setCustomId(`${this.gameid}-doneJump`)
                .setLabel('Done Jumping')
                .setStyle(ButtonStyle.Success);
            buttons.push(doneButton);
        }

        return this.makeactionRows(buttons);
    }

}

module.exports = {
    name: 'checkers',
    description: 'Play a game of checkers against another user or me!',
    aliases: ['draughts'],
    parent: 'games',

    async execute(message) {
        const opponent = message.mentions.users.first() || message.client.user;

        if (opponent.id === message.author.id) {
            return message.reply("You can't play against yourself!");
        }

        const game = new checkersGame(message.author, opponent, message.channel);
        await game.startGame();
    }
};
