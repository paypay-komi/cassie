const { idToName } = require("../../../../lib/commandResolver");

module.exports = {
	name: "guild",
	parent: "list",
	description: "List all guild-wide disabled commands.",

	async execute(message, args) {
		const { db } = message.client;

		const rows = await db.commandAccess.getGuildDisabled(message.guildId);

		if (!rows.length) {
			return message.reply("✅ No commands are disabled guild-wide.");
		}

		const lines = rows
			.map((r) => {
				const name = idToName(message.client, r.commandId);
				return name
					? `• \`${name}\``
					: `• \`${r.commandId}\` *(unknown)*`;
			})
			.sort();

		let current = "🚫 **Guild-Disabled Commands**\n\n";
		for (const line of lines) {
			const next = current + line + "\n";
			if (next.length > 1900) {
				await message.channel.send(current);
				current = line + "\n";
			} else {
				current = next;
			}
		}
		await message.channel.send(current);
	},
};
