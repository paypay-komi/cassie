const { idToName } = require("../../../../lib/commandResolver");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "e7e5e366-f96d-4334-99de-98f26fe166d1",
	name: "guild",
	parent: "list",
	description: "List all guild-wide disabled commands.",

	async execute(message, args) {
		const { db } = message.client;

		const rows = await db.commandAccess.getGuildDisabled(message.guildId);

		if (!rows.length) {
			return message.reply(pingSafeMesage("✅ No commands are disabled guild-wide.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management."));
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
				await message.channel.send(pingSafeMesage(current));
				current = line + "\n";
			} else {
				current = next;
			}
		}
		await message.channel.send(pingSafeMesage(current + "\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management."));
	},
};
