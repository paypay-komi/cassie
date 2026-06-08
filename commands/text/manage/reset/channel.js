const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "channel",
	parent: "reset",
	description:
		"Remove channel-level allow/deny for a command. Usage: `c.manage reset channel #channel <command>`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage reset channel #channel <command>`",
			);
		}

		const raw = args.shift();
		const channelId = raw.replace(/[<#>]/g, "");
		const ch = message.guild.channels.cache.get(channelId);
		if (!ch) return message.reply("❌ Channel not found.");

		const input = args.join(" ").toLowerCase();
		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(`❌ ${err.message}`);
		}

		await message.client.db.prisma.guildChannelCommandAccess.deleteMany({
			where: { guildId: message.guildId, channelId, commandId },
		});

		return message.reply(
			`✅ Override removed for \`${input}\` in ${ch.toString()}. It now uses default permissions.`,
		);
	},
};
