const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	MessageFlags,
} = require("discord.js");
const { ArgsBuilder } = require("../../../lib/argsBuilder");

module.exports = {
	commandId: "3c4d5e6f-7a8b-4c3d-9e4f-5a6b7c8d9e0f",
	name: "channel",
	description: "Set the channel for boost thank-you messages",
	aliases: ["chan"],
	parent: "boost",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	args: ArgsBuilder.create().channel("channel", {
		required: true,
		description: "Channel for boost thank-you messages",
	}),

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		const channelId = args[0] ? args[0].replace(/[<#>]/g, "") : null;
		const channel = channelId
			? guild.channels.cache.get(channelId)
			: null;

		if (!channel || !channel.isTextBased()) {
			return message.reply({
				components: [
					new ContainerBuilder()
						.addTextDisplayComponents(
							new TextDisplayBuilder().setContent(
								`## ❌ Invalid Channel\nPlease mention a text channel, e.g. \`c.boost channel #boosts\`.`,
							),
						)
						.setAccentColor(0xed4245),
				],
				flags: MessageFlags.IsComponentsV2,
				allowedMentions: { parse: [] },
			});
		}

		await prisma.guildBoostConfig.upsert({
			where: { guildId: guild.id },
			update: { channelId: channel.id },
			create: { guildId: guild.id, channelId: channel.id },
		});

		return message.reply({
			components: [
				new ContainerBuilder()
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent(
							`## ✅ Boost Channel Set\nThank-you messages for boosts will go to ${channel}.\n\nSet a booster role with \`c.boost role @Role\`.`,
						),
					)
					.setAccentColor(0x57f287),
			],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		});
	},
};