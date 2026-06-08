const { PermissionsBitField } = require("discord.js");

module.exports = {

commandId: "72955a75-0960-4591-a994-d94adfcc6da1",
	name: "edit",
	parent: "tag",
	description: "Edit a tag's content. Only the creator or members with Manage Messages can edit tags.",
	dmUse: false,

	async execute(message, args) {
		const db = require("../../../db");

		if (args.length < 2) {
			return message.reply("Usage: `c.tag edit <name> <new content>`");
		}

		const name = args[0].toLowerCase();
		const content = args.slice(1).join(" ");

		if (!content) {
			return message.reply("Tag content cannot be empty.");
		}

		if (content.length > 2000) {
			return message.reply("Tag content must be 2000 characters or less.");
		}

		const tag = await db.prisma.guildTag.findUnique({
			where: {
				guildId_name: { guildId: message.guildId, name },
			},
		});

		if (!tag) {
			return message.reply(`No tag named \`${name}\` exists in this server.`);
		}

		const canManage = message.member?.permissions?.has(
			PermissionsBitField.Flags.ManageMessages,
		);

		if (tag.creatorId !== message.author.id && !canManage) {
			return message.reply(
				"You can only edit your own tags unless you have the Manage Messages permission.",
			);
		}

		await db.prisma.guildTag.update({
			where: { id: tag.id },
			data: { content },
		});

		message.reply(`✅ Tag \`${name}\` updated.`);
	},
};
