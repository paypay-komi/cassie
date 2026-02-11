const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

class TicTacToe {
    constructor(player1, player2, channel) {
        this.board = [
            [' ', ' ', ' '],
            [' ', ' ', ' '],
            [' ', ' ', ' ']
        ];

        this.player1 = player1;
        this.player2 = player2;
        this.currentPlayer = player1;
        this.gameOver = false;
        this.isAi = player2.bot;
        this.channel = channel;

        // Unique game ID for buttons
        this.gameID = `${player1.id}-${player2.id}`;
        const prefix = `ttt-${this.gameID}`;

        // Create the button grid
        const createButton = (r, c) => new ButtonBuilder()
            .setCustomId(`${prefix}-${r},${c}`)
            .setLabel('\u2B1B') // black square
            .setStyle(ButtonStyle.Secondary);

        const row1 = new ActionRowBuilder().addComponents(createButton(0, 0), createButton(0, 1), createButton(0, 2));
        const row2 = new ActionRowBuilder().addComponents(createButton(1, 0), createButton(1, 1), createButton(1, 2));
        const row3 = new ActionRowBuilder().addComponents(createButton(2, 0), createButton(2, 1), createButton(2, 2));

        this.buttons = [row1, row2, row3];
        this.blunderChance = Math.max(0, Math.min(1, Math.random()));
        this.blunderBadness = Math.round(Math.random() * 9); // decides how many moves the ai will decide from the top instead of picking the best move, 0 means it will always pick the best move, 9 means it will pick randomly from the top 10 moves
    }

    async start() {
        // Send initial game message
        this.gameMessage = await this.channel.send({
            content: `Tic Tac Toe: ${this.player1} vs ${this.player2}\nIt's ${this.currentPlayer}'s turn!`,
            components: this.buttons
        });
        if (this.isAi) {
            this.channel.send(`Blunder Chance: ${(this.blunderChance * 100).toFixed(2)}%, Blunder Badness: ${this.blunderBadness.toFixed(2)} (0=best move, 9=random from top 10)`);
        }
        const filter = (interaction) => {
            if (!interaction.isButton()) return false;

            const [prefix, player1Id, player2Id] = interaction.customId.split('-');
            const gameID = `${player1Id}-${player2Id}`;

            return prefix === 'ttt' && gameID === this.gameID;
        };


        const collector = this.channel.createMessageComponentCollector({
            filter,
            time: 5 * 60 * 1000 // 5 minutes
        });

        collector.on('collect', async (interaction) => {
            const [prefix, player1Id, player2Id, position] = interaction.customId.split('-');
            const [row, col] = position.split(',').map(Number);
            await interaction.deferUpdate(); // ALWAYS defer or reply to avoid "This interaction failed" message, even if you plan to update later in the code
            if (this.gameOver) {
                await interaction.followUp({ content: "The game is already over! (this is an error should never happen)", flags: MessageFlags.Ephemeral });
                return;
            }
            if (interaction.user.id !== this.currentPlayer.id) {
                await interaction.followUp({ content: "It's not your turn!", flags: MessageFlags.Ephemeral });
                return;
            }

            if (this.board[row][col] !== ' ') {
                await interaction.followUp({ content: "Spot already taken!", flags: MessageFlags.Ephemeral });
                return;
            }

            // Set X/O emoji
            const symbol = this.currentPlayer.id === this.player1.id ? '❌' : '⭕';
            this.board[row][col] = symbol;
            this.buttons[row].components[col].setLabel(symbol).setDisabled(true);
            // debug uncoment for debugging await this.gameMessage.reply(`${this.currentPlayer} placed ${symbol} at (${row + 1}, ${col + 1})`);
            // debug uncoment for debugging await this.gameMessage.reply(`Current Board:\n${this.board.map(r => r.join(' | ')).join('\n---------\n')}`);
            // debug uncoment for debugging await this.gameMessage.reply(`Checking win condition...`);
            // Check for win
            const winner = this.checkWin();
            // debug uncoment for debugging await this.gameMessage.reply(`Win condition checked. ${winner ? `Winner found: ${this.currentPlayer} with ${symbol}` : 'No winner yet.'}`);

            if (winner) {
                this.gameOver = true;
                // debug uncoment for debugging await this.gameMessage.reply(`Game over! ${this.currentPlayer} wins! stoping collector...`);

                collector.stop();
                // debug uncoment for debugging await this.gameMessage.reply(`collector stopped.`);
                // debug uncoment for debugging await this.gameMessage.reply(`updating game message...`);
                await interaction.editReply({ content: `${this.currentPlayer} (${symbol}) wins!`, components: this.buttons });
                // debug uncoment for debugging await this.gameMessage.reply(`game message updated.`);
                // debug uncoment for debugging await this.gameMessage.reply(`Exiting turn handler.`);
                return;
            }


            // Check for draw
            if (this.checkDraw()) {
                // debug uncoment for debugging await this.gameMessage.reply(`Game over! It's a draw! setting gameover flag`);
                this.gameOver = true;
                // debug uncoment for debugging await this.gameMessage.reply(`stoping collector...`);
                collector.stop();
                // debug uncoment for debugging await this.gameMessage.reply(`collector stopped.`);
                // debug uncoment for debugging await this.gameMessage.reply(`updating game message...`);
                await interaction.editReply({ content: "It's a draw!", components: this.buttons });
                // debug uncoment for debugging await this.gameMessage.reply(`game message updated.`);
                // debug uncoment for debugging await this.gameMessage.reply(`Exiting turn handler.`);
                return;
            }
            // debug uncoment for debugging await this.gameMessage.reply(`No win or draw detected. Continuing game.`);
            // debug uncoment for debugging await this.gameMessage.reply(`Switching players...`);
            // Switch player
            this.currentPlayer = this.currentPlayer.id === this.player1.id ? this.player2 : this.player1;
            // debug uncoment for debugging await this.gameMessage.reply(`Players switched. It's now ${this.currentPlayer}'s turn. updating game message...`);
            await interaction.editReply({
                content: `It's ${this.currentPlayer}'s turn!`,
                components: this.buttons
            });
            // debug uncoment for debugging await this.gameMessage.reply(`game message updated.`);
            // debug uncoment for debugging await this.gameMessage.reply(`checking if AI move is needed...`);
            // AI move if applicable
            if (this.isAi && this.currentPlayer.bot) {
                // debug uncoment for debugging await this.gameMessage.reply(`AI turn detected. making AI move...`);
                await this.makeAiMove();
                // debug uncoment for debugging await this.gameMessage.reply(`AI move completed. Exiting turn handler.`);
            }
        });

        collector.on('end', async () => {
            // Disable all buttons if game ended
            // debug uncoment for debugging await this.gameMessage.reply(`Game ended. Disabling all buttons...`);
            this.buttons.forEach(row =>
                row.components.forEach(button => button.setDisabled(true))
            );
            // debug uncoment for debugging await this.gameMessage.reply(`Buttons disabled.`);

            // double check for wins and draws incase it something slipped through and the game ended without the collector stopping
            const winner = this.checkWin();
            if (winner && !this.gameOver) {
                this.gameOver = true;
                await this.gameMessage.edit({ content: `        ${this.currentPlayer} (${winner}) wins!`, components: this.buttons });
                return;
            }
            if (this.checkDraw() && !this.gameOver) {
                this.gameOver = true;
                await this.gameMessage.edit({ content: "It's a draw!", components: this.buttons });
                return;
            }
            // debug uncoment for debugging await this.gameMessage.reply(`finding end reason...`);
            if (!this.gameOver) {
                // debug uncoment for debugging await this.gameMessage.reply(`No win or draw detected. Assuming timeout. updating game message...`);
                await this.gameMessage.edit({ content: 'Game ended due to inactivity.', components: this.buttons });
            } else {
                // debug uncoment for debugging await this.gameMessage.reply(`Game already marked as over. updating game message...`);
                await this.gameMessage.edit({ components: this.buttons });
            }
            // debug uncoment for debugging await this.gameMessage.reply(`Game message updated. Exiting collector end handler.`);
        });
    }

    checkWin() {
        const b = this.board;
        const lines = [
            // rows
            [[0, 0], [0, 1], [0, 2]],
            [[1, 0], [1, 1], [1, 2]],
            [[2, 0], [2, 1], [2, 2]],
            // columns
            [[0, 0], [1, 0], [2, 0]],
            [[0, 1], [1, 1], [2, 1]],
            [[0, 2], [1, 2], [2, 2]],
            // diagonals
            [[0, 0], [1, 1], [2, 2]],
            [[0, 2], [1, 1], [2, 0]]
        ];

        for (const line of lines) {
            const [a, b, c] = line;
            const val = this.board[a[0]][a[1]];
            if (val !== ' ' && val === this.board[b[0]][b[1]] && val === this.board[c[0]][c[1]]) {
                return val; // return winning symbol ❌ or ⭕
            }
        }
        return null;
    }

    checkDraw() {
        return this.board.flat().every(cell => cell !== ' ');
    }

    async makeAiMove() {
        const isBlunder = Math.random() < this.blunderChance;
        const bestMove = isBlunder ? this.findBlunderMove() : this.findBestMove();
        if (!bestMove) return;

        const { row, col } = bestMove;
        this.board[row][col] = '⭕';
        this.buttons[row].components[col].setLabel('⭕').setDisabled(true);

        const winner = this.checkWin();
        if (winner) {
            this.gameOver = true;
            await this.gameMessage.edit({ content: `${this.player2} (⭕) wins!`, components: this.buttons });
            return;
        }

        if (this.checkDraw()) {
            this.gameOver = true;
            await this.gameMessage.edit({ content: "It's a draw!", components: this.buttons });
            return;
        }

        // Switch back to player
        if (this.gameOver) return;
        this.currentPlayer = this.player1;
        await this.gameMessage.edit({ content: `It's ${this.currentPlayer}'s turn! ${isBlunder ? '( the ai Blundered!)' : ''}`, components: this.buttons });
    }
    findBlunderMove() {
        const moves = [];

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.board[i][j] === ' ') {
                    this.board[i][j] = '⭕';
                    const score = this.minimax(0, false);
                    this.board[i][j] = ' ';
                    moves.push({ row: i, col: j, score });
                }
            }
        }

        // Sort moves descending by score (best first)
        moves.sort((a, b) => b.score - a.score);

        // Pick randomly from the top N moves (like top 2)
        const topN = this.blunderBadness + 1; // tweak to make it more/less smart
        const chosen = moves[Math.floor(Math.random() * Math.min(topN, moves.length))];
        return chosen;
    }

    findBestMove() {
        let bestVal = -Infinity;
        let bestMove = null;

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.board[i][j] === ' ') {
                    this.board[i][j] = '⭕';
                    const moveVal = this.minimax(0, false);
                    this.board[i][j] = ' ';
                    if (moveVal > bestVal) {
                        bestVal = moveVal;
                        bestMove = { row: i, col: j };
                    }
                }
            }
        }

        return bestMove;
    }

    minimax(depth, isMax) {
        const winner = this.checkWin();
        if (winner === '⭕') return 10 - depth;
        if (winner === '❌') return depth - 10;
        if (this.checkDraw()) return 0;

        if (isMax) {
            let best = -Infinity;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (this.board[i][j] === ' ') {
                        this.board[i][j] = '⭕';
                        best = Math.max(best, this.minimax(depth + 1, false));
                        this.board[i][j] = ' ';
                    }
                }
            }
            return best;
        } else {
            let best = Infinity;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (this.board[i][j] === ' ') {
                        this.board[i][j] = '❌';
                        best = Math.min(best, this.minimax(depth + 1, true));
                        this.board[i][j] = ' ';
                    }
                }
            }
            return best;
        }
    }
}
module.exports = {
    name: 'tic-tac-toe',
    description: 'Play a game of tic-tac-toe against another user or me!',
    aliases: ['ttt', 'tictactoe', 'tic-tac-toe'],
    parent: 'games',

    async execute(message, args) {
        const opponent = message.mentions.users.first();
        if (!opponent) {
            return message.reply('Please mention a user to play against. you can mention me if you want to play against me!');
        }
        if (opponent.id === message.author.id) {
            return message.reply('You cannot play against yourself.');
        }
        const game = new TicTacToe(message.author, opponent, message.channel);
        await game.start();

    }
};
