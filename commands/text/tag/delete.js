const { PermissionsBitField } = require("discord.js");
const { ArgsBuilder } = require("../../../lib/argsBuilder");

module.exports = {

commandId: "b9c83c22-006c-418f-bf37-8bbfd278e43c",
	name: "delete",
	parent: "tag",
	description: "Delete a tag. Only the creator or members with Manage Messages can delete tags.",
	args: ArgsBuilder.create()
		.string("name", { required: true, description: "Tag name" }),
	aliases: ["del", "remove", "rm"],
	guildOwnerOnly: true,
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
