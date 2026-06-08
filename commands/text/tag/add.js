module.exports = {
	commandId: "2986f8de-bd20-44d4-9b8d-51e0d6d4b71a",
	name: "add",
	parent: "tag",
	description: "Create a new tag.",
	guildOwnerOnly: true,
	dmUse: false,

	async execute(message, args) {
		const db = require("../../../db");

		if (!args.length) {
			return message.reply(
				"Usage: `c.tag add <name> <content>` — e.g. `c.tag add rules No spamming!`",
			);
		}

		const name = args[0].toLowerCase();
		const content = args.slice(1).join(" ");

		if (!content) {
			return message.reply("Tag content cannot be empty.");
		}

		if (content.length > 2000) {
			return message.reply(
				"Tag content must be 2000 characters or less.",
			);
		}

		const existing = await db.prisma.guildTag.findUnique({
			where: {
				guildId_name: { guildId: message.guildId, name },
			},
		});

		if (existing) {
			return message.reply(
				`A tag named \`${name}\` already exists in this server. Use \`c.tag edit ${name} <new content>\` to update it.`,
			);
		}

		await db.prisma.guildTag.create({
			data: {
				guildId: message.guildId,
				name,
				content,
				creatorId: message.author.id,
			},
		});

		message.reply(`✅ Tag \`${name}\` created.`);
	},
};
