const { resolveRequired, suggestCommandNames } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "8e054c48-7a8c-4bed-b38f-9a2bcebe83d7",
	name: "channel",
	parent: "reset",
	description:
		"Remove channel-level allow/deny for a command. Usage: `c.manage reset channel #channel <command>`",
	args: ArgsBuilder.create()
		.channel("channel", { required: true, description: "The channel" })
		.string("command", { autocomplete: suggestCommandNames, required: true, description: "The command to reset" }),

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(pingSafeMesage(
				"❌ Usage: `c.manage reset channel #channel <command>`",
			));
		}

		const raw = args.shift();
		const channelId = raw.replace(/[<#>]/g, "");
		const ch = message.guild.channels.cache.get(channelId);
		if (!ch) return message.reply(pingSafeMesage("❌ Channel not found."));

		const input = args.join(" ").toLowerCase();
		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(pingSafeMesage(`❌ ${err.message}`));
		}

		await message.client.db.prisma.guildChannelCommandAccess.deleteMany({
			where: { guildId: message.guildId, channelId, commandId },
		});

		return message.reply(pingSafeMesage(
			`✅ Override removed for \`${input}\` in ${ch.toString()}. It now uses default permissions.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
		));
	},
};
