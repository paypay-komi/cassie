module.exports = {
	commandId: "2c6dfa53-2bde-4503-b6c1-12f8b016c70b",
	name: "info",
	parent: "tag",
	description: "Show metadata about a tag.",
	guildOwnerOnly: true,
	dmUse: false,

	async execute(message, args) {
		const db = require("../../../db");

		if (!args.length) {
			return message.reply("Usage: `c.tag info <name>`");
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

		const created = `<t:${Math.floor(tag.createdAt.getTime() / 1000)}:R>`;
		const updated = `<t:${Math.floor(tag.updatedAt.getTime() / 1000)}:R>`;

		message.reply(
			[
				`📋 **Tag:** \`${tag.name}\``,
				`**Uses:** ${tag.uses}`,
				`**Created by:** <@${tag.creatorId}> ${created}`,
				`**Last updated:** ${updated}`,
			].join("\n"),
		);
	},
};
