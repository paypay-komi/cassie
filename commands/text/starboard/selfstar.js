const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const starboard = require("../../../lib/starboard");

module.exports = {

commandId: "a9f5150d-f001-4dd3-8e23-a2d1a308a10c",
	name: "selfstar",
	parent: "starboard",
	description: "Toggle whether authors can star their own messages (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;
		const emoji = starboard.parseEmojiInput(args[0]);
		const value = (args[1] || "").toLowerCase();

		const on = ["on", "true", "yes"].includes(value);
		const off = ["off", "false", "no"].includes(value);

		if (!emoji || (!on && !off))
			return message.reply(
				buildMessage("Usage: `c.starboard selfstar <emoji> on|off`"),
			);

		const board = await prisma.starboard.findUnique({
			where: { guildId_emoji: { guildId, emoji } },
		});
		if (!board) return message.reply(buildMessage("No starboard uses that emoji."));

		await prisma.starboard.update({
			where: { id: board.id },
			data: { selfStar: on },
		});
		return message.reply(
			buildMessage(`Self-star for **${emoji}** is now **${on ? "on" : "off"}**.`),
		);
	},
};
