const { idToName } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "0fa589f7-2207-4b71-b961-abac3f0ffade",
	name: "user",
	parent: "list",
	description: "List all user-based command access overrides.",

	async execute(message, args) {
		const { db } = message.client;

		const rows = await db.prisma.guildUserCommandAccess.findMany({
			where: { guildId: message.guildId },
		});

		if (!rows.length) {
			return message.reply("No user-based command overrides configured.");
		}

		const lines = [];
		for (const r of rows) {
			const name = idToName(message.client, r.commandId) ?? `${r.commandId} *(unknown)*`;
			let userName = r.userId;
			try {
				const user = await message.client.users.fetch(r.userId);
				userName = `${user.tag} (${r.userId})`;
			} catch { /* keep raw ID */ }
			const tag = r.allowed ? "✅ allow" : "🚫 deny";
			lines.push(`• ${tag} **${userName}** → \`${name}\``);
		}

		lines.sort();
		let current = "👤 **User Command Overrides**\n\n";
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
