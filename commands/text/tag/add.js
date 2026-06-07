module.exports = {
	name: "add",
	parent: "tag",
	description: "Create a new tag.",

	async execute(message, args) {
		const db = require("../../../db");

		if (!message.guildId) {
			return message.reply("Tags are only available in servers.");
		}

		if (!args.length) {
			return message.reply(
				"Usage: `c.tag add <name> <content>` — e.g. `c.tag add rules No spamming!`",
			);
		}

		const name = args[0].toLowerCase();
		const content = args.slice(1).join(" ");

		if (!/^[\w-]+$/.test(name)) {
			return message.reply(
				"Tag name can only contain letters, numbers, hyphens, and underscores.",
			);
		}

		if (!content) {
			return message.reply(
				"Tag content cannot be empty.",
			);
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
