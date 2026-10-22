const { PermissionsBitField } = require("discord.js");
const db = require("../../../db");

module.exports = {

commandId: "b2c3d4e5-f6a7-8901-bcde-f23456789012",
	name: "create",
	description: "Set up this channel as a counting channel",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.ManageMessages,
	],
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],

	parent: "counting",
	aliases: ["make", "setup"],
	async execute(message, args) {
		const channelMention = args.shift();
		const channel = channelMention
			? message.guild.channels.cache.get(channelMention.replace(/[<#>]/g, ""))
			: message.channel;

		if (!channel || !channel.isTextBased()) return message.reply("that's not a valid text channel");

		const existing = await db.prisma.countingConfig.findFirst({
			where: { guildId: message.guild.id, channelId: channel.id },
		});

		if (existing && existing.enabled) return message.reply("this channel is already a counting channel");

		await db.prisma.countingConfig.upsert({
			where: { guildId: message.guild.id },
			create: {
				guildId: message.guild.id,
				channelId: channel.id,
				enabled: true,
				currentCount: 0n,
				highScore: 0n,
			},
			update: {
				channelId: channel.id,
				enabled: true,
			},
		});

		message.reply({
			content: `<#${channel.id}> is now a counting channel! Start counting from 1.`,
			allowedMentions: { repliedUser: false },
		});
	},
};