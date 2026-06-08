const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "e7976110-87aa-4ccc-a7dd-8b07acb2b696",
	name: "channel",
	parent: "enable",
	description:
		"Re-enable a command in a specific channel. Usage: `c.manage enable channel #channel <command>`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage enable channel #channel <command>`",
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

		await message.client.db.commandAccess.setChannelAccess(
			message.guildId,
			channelId,
			commandId,
			true,
		);

		return message.reply(
			`✅ \`${input}\` is now allowed in ${ch.toString()}. This will override guild-wide and channel-specific disables.`,
		);
	},
};
