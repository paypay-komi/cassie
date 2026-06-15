const { PermissionsBitField } = require("discord.js");

module.exports = {
	commandId: "e83b6c9d-1a4f-4e7b-8c2d-5f9a0b1c3e7f",
	name: "unsubscribe",
	aliases: ["unsub"],
	description: "Stop receiving bot announcements in this server.",
	category: "Utility",
	dmUse: false,
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],

	async execute(message, args) {
		const prefix = await message.client.db.guild.getPrefix(message.guildId);
		const existing = await message.client.db.announcements.get(message.guildId);

		// Clean up the webhook if one exists
		if (existing.channelId && existing.webhookId && existing.webhookToken) {
			try {
				const webhook = await message.client.fetchWebhook(
					existing.webhookId,
					existing.webhookToken,
				);
				await webhook.delete("Server unsubscribed from announcements");
			} catch {
				// Webhook already gone, fine
			}
		}

		// Mark as opted out to stop nagging
		await message.client.db.announcements.unsubscribe(message.guildId);

		await message.reply(
			existing.channelId
				? "✅ Unsubscribed. No more announcements here.\n" +
					`If you change your mind, run \`${prefix}subscribe #channel\` anytime.`
				: "✅ I'll stop asking about announcements.\n" +
					`If you want them later, run \`${prefix}subscribe #channel\`.`,
		);
	},
};
