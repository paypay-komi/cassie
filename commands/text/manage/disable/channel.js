const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "channel",
	parent: "disable",
	description:
		"Disable a command in a specific channel. Usage: `c.manage disable channel #channel <command>`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage disable channel #channel <command>`",
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

		await message.client.db.commandAccess.setChannelDisabled(
			message.guildId,
			channelId,
			commandId,
			true,
		);

		return message.reply(
			`🚫 \`${input}\` has been disabled in ${ch.toString()}.`,
		);
	},
};
