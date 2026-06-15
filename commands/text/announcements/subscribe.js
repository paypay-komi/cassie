const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../../lib/logger");
const { ArgsBuilder } = require("../../../lib/argsBuilder");

module.exports = {
	commandId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
	name: "subscribe",
	aliases: ["sub", "announcements"],
	description: "Set the announcement channel for bot updates (via webhook).",
	category: "Utility",
	dmUse: false,
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],

	args: ArgsBuilder.create().channel("channel", {
		description: "The channel to send announcements to",
	}),

	async execute(message, args) {
		const log = getLogger("Subscribe");
		const prefix = await message.client.db.guild.getPrefix(message.guildId);

		// Check current status
		const existing = await message.client.db.announcements.get(message.guildId);

		if (args.length === 0) {
			if (existing.channelId) {
				const channel = message.guild.channels.cache.get(existing.channelId);
				return message.reply(
					channel
						? `📢 Announcements currently go to ${channel}.\n` +
						  `Change it with \`${prefix}subscribe #channel\``
						: `📢 Announcements are set but the channel was deleted.\n` +
						  `Reset with \`${prefix}subscribe #channel\``,
				);
			}
			return message.reply(
				`📢 No announcement channel set.\n` +
					`Use \`${prefix}subscribe #channel\` to set one up.\n\n` +
					`I'll create a webhook there so announcements look clean.\n` +
					`I need **Manage Webhooks** permission in the channel.`,
			);
		}

		// Parse channel from mention or ID
		const channelId = args[0].replace(/[<#>]/g, "");
		const channel = message.guild.channels.cache.get(channelId);

		if (!channel || (channel.type !== 0 && channel.type !== 5)) {
			return message.reply("❌ Please mention a valid text or announcement channel.");
		}

		// Check bot permissions
		const botMember = message.guild.members.me;
		if (!channel.permissionsFor(botMember).has("ManageWebhooks")) {
			return message.reply(
				`❌ I need **Manage Webhooks** permission in ${channel} to set up announcements.\n\n` +
					`Grant it and try again.`,
			);
		}

		try {
			// Delete old webhook if exists
			if (existing.webhookId && existing.webhookToken) {
				try {
					const oldWebhook = await message.client.fetchWebhook(
						existing.webhookId,
						existing.webhookToken,
					);
					await oldWebhook.delete("Announcement channel changed");
				} catch {
					// Old webhook already gone, that's fine
				}
			}

			// Create new webhook
			const webhook = await channel.createWebhook({
				name: message.client.user.username,
				avatar: message.client.user.displayAvatarURL(),
				reason: `Announcement channel set by ${message.author.tag}`,
			});

			await message.client.db.announcements.subscribe(
				message.guildId,
				channel.id,
				webhook.id,
				webhook.token,
			);

			// Test message via webhook
			await webhook.send({
				content:
					"✅ **Announcements channel set!** Future updates will appear here via webhook.",
			});

			await message.reply(
				`✅ Announcements will go to ${channel} via webhook.\n` +
					`Use \`${prefix}unsubscribe\` to stop receiving them.`,
			);
		} catch (err) {
			log.error(`Subscribe failed: ${err.message}`);
			await message.reply(
				`❌ Failed to set up announcements: ${err.message}`,
			);
		}
	},
};
