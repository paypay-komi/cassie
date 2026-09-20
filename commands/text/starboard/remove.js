const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const starboard = require("../../../lib/starboard");

module.exports = {

commandId: "9caaadf5-e5e3-459e-8248-02f50a60d660",
	name: "remove",
	parent: "starboard",
	description: "Delete a starboard (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;
		const emoji = starboard.parseEmojiInput(args[0]);

		if (!emoji)
			return message.reply(buildMessage("Usage: `c.starboard remove <emoji>`"));

		const board = await prisma.starboard.findUnique({
			where: { guildId_emoji: { guildId, emoji } },
		});
		if (!board) return message.reply(buildMessage("No starboard uses that emoji."));

		await prisma.starboardEntry.deleteMany({
			where: { starboardId: board.id },
		});
		await prisma.starboard.delete({ where: { id: board.id } });

		return message.reply(buildMessage(`🗑️ Removed the **${emoji}** starboard.`));
	},
};
