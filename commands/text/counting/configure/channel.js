const { PermissionsBitField } = require("discord.js");
const db = require("../../../../db");
const { buildMessage } = require("../../../../lib/v2Reply");

module.exports = {

commandId: "c9d0e1f2-a3b4-5678-2345-901234567890",
	name: "channel",
	description: "Change the counting channel",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config) return message.reply(buildMessage("Counting isn't set up.", 0xED4245));

		const channelMention = args.shift();
		if (!channelMention) return message.reply(buildMessage(`Current channel: <#${config.channelId}>`, 0x5865F2));

		const channelId = channelMention.replace(/[<#>]/g, "");
		const channel = message.guild.channels.cache.get(channelId);
		if (!channel || !channel.isTextBased()) return message.reply(buildMessage("Invalid text channel.", 0xED4245));

		await db.prisma.countingConfig.update({ where: { guildId: message.guild.id }, data: { channelId } });
		message.reply(buildMessage(`Counting channel changed to <#${channelId}>`, 0x28A745));
	},
};