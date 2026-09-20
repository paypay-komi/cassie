const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const starboard = require("../../../lib/starboard");

module.exports = {

commandId: "c627c4b1-b213-4418-ac7f-58cad8b94e25",
	name: "threshold",
	parent: "starboard",
	description: "Set a starboard's star threshold (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;
		const emoji = starboard.parseEmojiInput(args[0]);
		const n = parseInt(args[1], 10);

		if (!emoji || isNaN(n) || n < 1)
			return message.reply(
				buildMessage("Usage: `c.starboard threshold <emoji> <number>`"),
			);

		const board = await prisma.starboard.findUnique({
			where: { guildId_emoji: { guildId, emoji } },
		});
		if (!board) return message.reply(buildMessage("No starboard uses that emoji."));

		await prisma.starboard.update({
			where: { id: board.id },
			data: { threshold: n },
		});
		return message.reply(
			buildMessage(`**${emoji}** starboard threshold set to **${n}**.`),
		);
	},
};
