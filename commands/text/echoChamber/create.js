const { PermissionsBitField } = require("discord.js");
const db = require("../../../db");

module.exports = {

commandId: "12379f7f-7dbd-46d6-acbb-e2ccbb0acb1c",
	name: "create",
	description: "Set up this channel as an echo chamber",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.ManageMessages,
		PermissionsBitField.Flags.ManageWebhooks,
	],
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],

	parent: "echochamber",
	aliases: ["make"],
	/**
	 * @param {import("discord.js").Message<true>} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		const found = await db.prisma.echoChannel.findFirst({
			where: { channelId: message.channel.id },
		});

		if (found)
			return message.reply("this is already a echo chamber channel");
		const { id: webhookId, token: webhookToken } =
			await message.channel.createWebhook({
				name: "Echo Chamber",
			});
		await db.prisma.echoChannel.create({
			data: {
				channelId: message.channel.id,
				guildId: message.guild.id,
				webhookId: webhookId,
				webhookToken: webhookToken,
			},
		});
		message.reply({
			content: "this channel is now an echo chamber",
			embeds: [{
				color: 0x9b59b6,
				description:
					"It deletes messages out of order randomly and reposts them via webhook with a random delay, making it look like the original author said them — creating funny out of context moments and confusion.\n\n" +
					"Use `c.echochamber configure` to adjust the echo chance, delete delay, and echo delay.",
			}],
		});
	},
};
