const { idToName } = require("../../../../lib/commandResolver");

module.exports = {
	name: "channel",
	parent: "list",
	description: "List channel-specific disabled commands.",

	async execute(message, args) {
		const { db } = message.client;

		const rows = await db.prisma.guildChannelDisabledCommand.findMany({
			where: { guildId: message.guildId },
		});

		if (!rows.length) {
			return message.reply("No channel-specific disabled commands.");
		}

		const lines = [];
		for (const r of rows) {
			const name = idToName(message.client, r.commandId) ?? `${r.commandId} *(unknown)*`;
			const ch = message.guild.channels.cache.get(r.channelId);
			const chName = ch ? ch.toString() : `\`${r.channelId}\``;
			lines.push(`• ${chName} → \`${name}\``);
		}

		lines.sort();
		let current = "📺 **Channel-Disabled Commands**\n\n";
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
