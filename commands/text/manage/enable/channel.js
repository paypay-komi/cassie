const { resolveRequired, getAllCommandIds } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "e7976110-87aa-4ccc-a7dd-8b07acb2b696",
	name: "channel",
	parent: "enable",
	description:
		"Allow a command in a specific channel. Usage: `c.manage enable channel #channel <command>` or `c.manage enable channel #channel all`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage enable channel #channel <command>` or `c.manage enable channel #channel all`",
			);
		}

		const raw = args.shift();
		const channelId = raw.replace(/[<#>]/g, "");
		const ch = message.guild.channels.cache.get(channelId);
		if (!ch) return message.reply("❌ Channel not found.");

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
						allowed: true,
					})),
				}),
			]);
			return message.reply(
				`✅ All commands are now allowed in ${ch.toString()}.`,
			);
		}

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
			`✅ \`${input}\` is now allowed in ${ch.toString()}.`,
		);
	},
};
