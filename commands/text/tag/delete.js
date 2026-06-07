const { PermissionsBitField } = require("discord.js");

module.exports = {
	name: "delete",
	parent: "tag",
	description: "Delete a tag. Only the creator or members with Manage Messages can delete tags.",
	aliases: ["del", "remove", "rm"],
	dmUse: false,

	async execute(message, args) {
		const db = require("../../../db");

		if (!args.length) {
			return message.reply("Usage: `c.tag delete <name>`");
		}

		const name = args[0].toLowerCase();

		const tag = await db.prisma.guildTag.findUnique({
			where: {
				guildId_name: { guildId: message.guildId, name },
			},
		});

		if (!tag) {
			return message.reply(`No tag named \`${name}\` exists in this server.`);
		}

		// Only the creator or users with ManageMessages can delete
		const canManage = message.member?.permissions?.has(
			PermissionsBitField.Flags.ManageMessages,
		);

		if (tag.creatorId !== message.author.id && !canManage) {
			return message.reply(
				"You can only delete your own tags unless you have the Manage Messages permission.",
			);
		}

		await db.prisma.guildTag.delete({
			where: { id: tag.id },
		});

		message.reply(`✅ Tag \`${name}\` deleted.`);
	},
};
