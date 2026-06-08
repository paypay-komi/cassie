const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "c62f1a19-b3cd-40f0-880f-702716c3b7c7",
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

		await message.client.db.commandAccess.setChannelAccess(
			message.guildId,
			channelId,
			commandId,
			false,
		);

		return message.reply(
			`🚫 \`${input}\` is now denied in ${ch.toString()}.`,
		);
	},
};
