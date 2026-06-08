module.exports = {
	name: "channel",
	parent: "manage",
	description:
		"Manage channel-specific command restrictions. Provide the channel, then: disable or enable.",

	async execute(message, args, next) {
		if (!args.length) {
			return message.reply(
				"❌ Usage: `c.manage channel #channel <disable|enable> <command>`",
			);
		}

		// Consume the target channel
		const raw = args.shift();
		const channelId = raw.replace(/[<#>]/g, "");
		const channel = message.guild.channels.cache.get(channelId);
		if (!channel) return message.reply("❌ Channel not found.");

		// Store for subcommands to access
		this._targetChannel = channelId;

		// Continue resolving subcommands with remaining args
		return next(args);
	},
};
