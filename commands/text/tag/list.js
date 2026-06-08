module.exports = {
	commandId: "37c4bb25-3d1d-414c-9032-e924543ea6c9",
	name: "list",
	parent: "tag",
	description: "List all tags in this guild.",
	aliases: ["all"],
	dmUse: false,

	async execute(message, args) {
		const db = require("../../../db");

		const tags = await db.prisma.guildTag.findMany({
			where: { guildId: message.guildId },
			orderBy: { name: "asc" },
		});

		if (!tags.length) {
			return message.reply(
				"No tags exist in this server yet. Use `c.tag add <name> <content>` to create one.",
			);
		}

		const tagList = tags
			.map((t) => `\`${t.name}\` — ${t.uses} use(s)`)
			.join("\n");

		// Discord has a 2000 char limit for messages
		const chunks = [];
		let current = "**📋 Tags in this server:**\n\n";

		for (const line of tagList.split("\n")) {
			if ((current + line).length > 1900) {
				chunks.push(current);
				current = line + "\n";
			} else {
				current += line + "\n";
			}
		}
		chunks.push(current);

		for (const chunk of chunks) {
			await message.channel.send(chunk);
		}
	},
};
