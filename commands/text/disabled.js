const { idToName } = require("../../lib/commandResolver");

module.exports = {
	commandId: "b5c6d7e8-f9a0-4b1c-8d2e-3f4a5b6c7d8e",
	name: "disabled",
	aliases: ["listdisabled"],
	description: "List all commands disabled in this server. Only the server owner can use this.",
	guildOwnerOnly: true,
	dmUse: false,

	async execute(message, args) {
		const db = message.client.db;

		const rows = await db.commandAccess.getGuildDisabled(message.guildId);

		if (!rows.length) {
			return message.reply("✅ No commands are disabled in this server.");
		}

		// Resolve UUIDs to human-readable names
		const lines = rows
			.map((r) => {
				const name = idToName(message.client, r.commandId);
				return name ? `• \`${name}\`` : `• \`${r.commandId}\` *(unknown)*`;
			})
			.sort();

		// Paginate if needed
		const header = "🚫 **Disabled Commands**\n\n";
		let current = header;

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
