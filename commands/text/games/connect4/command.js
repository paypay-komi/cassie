const {
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SectionBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require("discord.js");
const Connect4Game = require("./Connect4Game");
const Connect4AI = require("./Connect4AI");

const V2_FLAGS = [MessageFlags.IsComponentsV2];

class Connect4 {
    constructor(player1, player2, channel) {
        this.game = new Connect4Game();
        this.player1 = player1;
        this.player2 = player2;
        this.currentPlayer = player1;
        this.gameOver = false;
        this.isAi = player2.bot;
        this.channel = channel;
        this.ai = this.isAi ? new Connect4AI() : null;
        this.gameID = `${player1.id}-${player2.id}`;
        this.buttonRows = this.#buildButtonRows();
    }

    #buildButtonRows() {
        const prefix = `c4-${this.gameID}`;
        const makeBtn = (col) =>
            new ButtonBuilder()
                .setCustomId(`${prefix}-${col}`)
                .setLabel(`${col + 1}`)
                .setStyle(ButtonStyle.Secondary);

        const row1 = new ActionRowBuilder().addComponents(
            makeBtn(0), makeBtn(1), makeBtn(2), makeBtn(3), makeBtn(4),
        );
        const row2 = new ActionRowBuilder().addComponents(
            makeBtn(5), makeBtn(6),
        );
        return [row1, row2];
    }

    #renderBoard() {
        const P1 = "🔴";
        const P2 = "🔵";
        const EMPTY = "⬛";
        const COL_NUMS = "1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣";

        const rows = this.game.board
            .map((row) =>
                row
                    .map((cell) => {
                        if (cell === null) return EMPTY;
                        return cell === this.player1.id ? P1 : P2;
                    })
                    .join(""),
            )
            .join("\n");

        return `${COL_NUMS}\n${rows}`;
    }

    #disableButtons() {
        this.buttonRows.forEach((row) =>
            row.components.forEach((btn) => btn.setDisabled(true)),
        );
    }

    #gameComponents(status) {
        const prefix = `c4-${this.gameID}`;

        const section = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Connect 4**\n${this.player1} 🔴 vs ${this.player2} 🔵\n\n${this.#renderBoard()}\n\n${status}`,
                ),
            )
            .setButtonAccessory(
                new ButtonBuilder()
                    .setCustomId(`${prefix}-info`)
                    .setLabel(this.gameOver ? "Game Over" : `${this.currentPlayer.displayName}'s turn`)
                    .setStyle(this.gameOver ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setDisabled(true),
            );

        return [section, ...this.buttonRows];
    }

    async start() {
        this.gameMessage = await this.channel.send({
            components: this.#gameComponents(`It's ${this.currentPlayer}'s turn!`),
            flags: V2_FLAGS,
        });

        const prefix = `c4-${this.gameID}`;
        const filter = (interaction) => {
            if (!interaction.isButton()) return false;
            const id = interaction.customId;
            if (!id.startsWith(prefix)) return false;
            const col = id.slice(prefix.length + 1);
            return /^[0-6]$/.test(col);
        };

        const collector = this.channel.createMessageComponentCollector({
            filter,
            message: this.gameMessage,
            time: 5 * 60 * 1000,
        });

        collector.on("collect", async (interaction) => {
            const col = parseInt(interaction.customId.split("-").pop());
            await interaction.deferUpdate();

            if (this.gameOver) {
                await interaction.followUp({
                    content: "Game is already over!",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (interaction.user.id !== this.currentPlayer.id) {
                await interaction.followUp({
                    content: "It's not your turn!",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const row = this.game.drop(col, this.currentPlayer.id);
            if (row === null) {
                await interaction.followUp({
                    content: "That column is full!",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (this.game.checkWin(row, col, this.currentPlayer.id)) {
                this.gameOver = true;
                collector.stop();
                this.#disableButtons();
                await interaction.editReply({
                    components: this.#gameComponents(`${this.currentPlayer} wins! 🎉`),
                    flags: V2_FLAGS,
                });
                return;
            }

            if (this.game.isFull()) {
                this.gameOver = true;
                collector.stop();
                this.#disableButtons();
                await interaction.editReply({
                    components: this.#gameComponents("It's a draw!"),
                    flags: V2_FLAGS,
                });
                return;
            }

            this.currentPlayer =
                this.currentPlayer.id === this.player1.id
                    ? this.player2
                    : this.player1;
            await interaction.editReply({
                components: this.#gameComponents(`It's ${this.currentPlayer}'s turn!`),
                flags: V2_FLAGS,
            });

            if (this.isAi && this.currentPlayer.bot) {
                await this.#makeAiMove();
            }
        });

        collector.on("end", async () => {
            this.#disableButtons();
            if (!this.gameOver) {
                this.gameOver = true;
                await this.gameMessage.edit({
                    components: this.#gameComponents("Game ended due to inactivity."),
                    flags: V2_FLAGS,
                });
            } else {
                await this.gameMessage.edit({
                    components: this.#gameComponents(""),
                    flags: V2_FLAGS,
                });
            }
        });
    }

    async #makeAiMove() {
        const col = this.ai.getMove(
            this.game,
            this.player2.id,
            this.player1.id,
        );
        if (col === -1 || col === undefined || col === null) return;
        const row = this.game.drop(col, this.currentPlayer.id);
        if (row === null) return;

        if (this.game.checkWin(row, col, this.currentPlayer.id)) {
            this.gameOver = true;
            this.#disableButtons();
            await this.gameMessage.edit({
                components: this.#gameComponents(`${this.currentPlayer} wins! 🎉`),
                flags: V2_FLAGS,
            });
            return;
        }

        if (this.game.isFull()) {
            this.gameOver = true;
            this.#disableButtons();
            await this.gameMessage.edit({
                components: this.#gameComponents("It's a draw!"),
                flags: V2_FLAGS,
            });
            return;
        }

        this.currentPlayer = this.player1;
        await this.gameMessage.edit({
            components: this.#gameComponents(`It's ${this.currentPlayer}'s turn!`),
            flags: V2_FLAGS,
        });
    }
}

module.exports = {
    commandId: "b34f5070-fcad-457c-8e13-5bd7d47a71c2",
    name: "connect4",
    description: "Play a game of Connect 4 against another user or the bot!",
    requiredBotPermissions: [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
    ],
    parent: "games",
    aliases: ["connectfour", "c4", "connect-four"],

    async execute(message, args) {
        const opponent = message.mentions.users.first();
        if (!opponent) {
            return message.reply(
                "Please mention a user to play against. You can mention me if you want to play against me!",
            );
        }
        if (opponent.id === message.author.id) {
            return message.reply("You cannot play against yourself.");
        }
        const game = new Connect4(
            message.author,
            opponent,
            message.channel,
        );
        await game.start();
    },
};
