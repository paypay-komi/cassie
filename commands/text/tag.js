const { PermissionsBitField } = require("discord.js");

module.exports = {
	name: "tag",
	description: "View a tag or manage tags for this guild.",
	aliases: ["tags"],
	dmUse: false,
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
	],

	async execute(message, args) {
		const db = require("../../db");

		if (!args.length) {
			return message.reply(
				"Usage: `c.tag <name>` to view a tag, or `c.tag add <name> <content>` to create one.",
			);
		}

		const name = args[0].toLowerCase();

		const tag = await db.prisma.guildTag.findUnique({
			where: {
				guildId_name: { guildId: message.guildId, name },
			},
		});

		if (!tag) {
			return message.reply(
				`No tag named \`${name}\` exists in this server. Use \`c.tag add ${name} <content>\` to create it.`,
			);
		}

		// Increment use count (fire and forget)
		await db.prisma.guildTag.update({
			where: { id: tag.id },
			data: { uses: { increment: 1 } },
		});

		await message.channel.send(tag.content);
	},
};
