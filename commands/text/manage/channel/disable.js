const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "disable",
	parent: "channel",
	description:
		"Disable a command in a specific channel. Usage: `c.manage channel #channel disable <command>`",

	async execute(message, args) {
		const target = this._middleArgs?.[0];
		if (!target || !args.length) {
			return message.reply(
				"❌ Usage: `c.manage channel #channel disable <command>`",
			);
		}

		const channelId = target.replace(/[<#>]/g, "");
		const ch = message.guild.channels.cache.get(channelId);
		if (!ch) return message.reply("❌ Channel not found.");

		const input = args.join(" ").toLowerCase();
		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(`❌ ${err.message}`);
		}

		await message.client.db.commandAccess.setChannelDisabled(
			message.guildId,
			channelId,
			commandId,
			true,
		);

		return message.reply(
			`✅ \`${input}\` has been disabled in ${ch.toString()}.`,
		);
	},
};
