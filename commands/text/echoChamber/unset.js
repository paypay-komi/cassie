const { PermissionsBitField } = require("discord.js");
const db = require("../../../db");

module.exports = {

commandId: "0e534d0a-0645-45af-bd55-a4083e90757d",
	name: "unset",
	description: "Remove the echo chamber from this channel",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.ManageMessages,
		PermissionsBitField.Flags.ManageWebhooks,
	],
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],

	parent: "echochamber",
	aliases: ["delete", "remove", "rm"],
	/**
	 * @param {import("discord.js").Message<true>} message
	 */
	async execute(message) {
		const found = await db.prisma.echoChannel.findFirst({
			where: { channelId: message.channel.id },
		});

		if (!found) return message.reply("this channel isn't an echo chamber");

		// Delete the webhook
		try {
			const webhook = await message.channel.fetchWebhook(found.webhookId);
			if (webhook) await webhook.delete();
		} catch {
			// webhook might already be deleted, that's fine
		}

		await db.prisma.echoChannel.delete({
			where: { id: found.id },
		});

		await message.reply("this channel is no longer an echo chamber");
	},
};
