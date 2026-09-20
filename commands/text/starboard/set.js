const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const starboard = require("../../../lib/starboard");

module.exports = {

commandId: "9bffe562-efac-4870-8ad8-959831a2abc1",
	name: "set",
	parent: "starboard",
	description: "Create or update a starboard (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;

		const channel = message.mentions.channels.first();
		const emoji = starboard.parseEmojiInput(args[1]);
		const thresholdArg = parseInt(args[2], 10);

		if (!channel)
			return message.reply(
				buildMessage("Usage: `c.starboard set #channel <emoji> [threshold]`"),
			);
		if (!emoji) return message.reply(buildMessage("Provide an emoji."));

		const existing = await prisma.starboard.findUnique({
			where: { guildId_emoji: { guildId, emoji } },
		});
		const threshold =
			!isNaN(thresholdArg) && thresholdArg > 0
				? thresholdArg
				: (existing?.threshold ?? 1);

		await prisma.starboard.upsert({
			where: { guildId_emoji: { guildId, emoji } },
			update: { channelId: channel.id, threshold },
			create: { guildId, channelId: channel.id, emoji, threshold },
		});

		return message.reply(
			buildMessage(
				`✅ Starboard for **${emoji}** set to ${channel} (threshold **${threshold}**).`,
			),
		);
	},
};
