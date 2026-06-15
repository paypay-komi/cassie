const { resolveRequired, getAllCommandIds, suggestCommandNames } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "c62f1a19-b3cd-40f0-880f-702716c3b7c7",
	name: "channel",
	parent: "disable",
	description: "Deny a command in a specific channel.",
	args: ArgsBuilder.create()
		.channel("channel", { required: true, description: "The channel to restrict" })
		.string("command", { autocomplete: suggestCommandNames, description: "Command name or \"all\"" }),

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(pingSafeMesage(
				"❌ Usage: `c.manage disable channel #channel <command>` or `c.manage disable channel #channel all`",
			));
		}

		const raw = args.shift();
		const channelId = raw.replace(/[<#>]/g, "");
		const ch = message.guild.channels.cache.get(channelId);
		if (!ch) return message.reply(pingSafeMesage("❌ Channel not found."));

		const input = args.join(" ").toLowerCase();

		if (input === "all") {
			const { prisma } = message.client.db;
			const allIds = getAllCommandIds(message.client);
			await prisma.$transaction([
				prisma.guildChannelCommandAccess.deleteMany({
					where: { guildId: message.guildId, channelId },
				}),
				prisma.guildChannelCommandAccess.createMany({
					data: allIds.map((id) => ({
						guildId: message.guildId,
						channelId,
						commandId: id,
						allowed: false,
					})),
				}),
			]);
			return message.reply(pingSafeMesage(
				`🚫 All commands are now denied in ${ch.toString()}.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
			));
		}

		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(pingSafeMesage(`❌ ${err.message}`));
		}

		await message.client.db.commandAccess.setChannelAccess(
			message.guildId,
			channelId,
			commandId,
			false,
		);

		return message.reply(pingSafeMesage(
			`🚫 \`${input}\` is now denied in ${ch.toString()}.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
		));
	},
};
