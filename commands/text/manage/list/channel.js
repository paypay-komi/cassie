const { idToName } = require("../../../../lib/commandResolver");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "731163e5-c901-4360-8600-aa8bdfc3f478",
	name: "channel",
	parent: "list",
	description: "List channel-specific allow/deny overrides.",

	async execute(message, args) {
		const { db } = message.client;

		const rows = await db.prisma.guildChannelCommandAccess.findMany({
			where: { guildId: message.guildId },
		});

		if (!rows.length) {
			return message.reply(pingSafeMesage("No channel-specific command overrides.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management."));
		}

		const lines = [];
		for (const r of rows) {
			const name = idToName(message.client, r.commandId) ?? `${r.commandId} *(unknown)*`;
			const ch = message.guild.channels.cache.get(r.channelId);
			const chName = ch ? ch.toString() : `\`${r.channelId}\``;
			const icon = r.allowed ? "✅" : "🚫";
			lines.push(`• ${chName} ${icon} \`${name}\``);
		}

		lines.sort();
		let current = "📺 **Channel Command Overrides**\n*(✅ = allowed, 🚫 = denied)*\n\n";
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
