const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../../lib/logger");

module.exports = {
	commandId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	name: "broadcast",
	aliases: ["announce", "bc"],
	description: "Send an announcement to all subscribed servers via webhook.",
	permissions: ["botOwner"],
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],

	async execute(message, args) {
		const log = getLogger("Broadcast");

		if (args.length === 0) {
			const prefix = message.client.prefix;
			return message.reply(
				`Usage: \`${prefix}broadcast <message>\` — sends to all subscribed servers.`,
			);
		}

		const content = args.join(" ");
		const client = message.client;

		// Confirm
		const confirm = await message.reply(
			`⚠️ About to broadcast to **all subscribed servers**.\n\n` +
				`**Message preview:**\n${content.slice(0, 500)}\n\n` +
				`Reply with \`yes\` to confirm, or anything else to cancel.`,
		);

		const filter = (m) => m.author.id === message.author.id;
		const collected = await message.channel
			.awaitMessages({ filter, max: 1, time: 30000, errors: ["time"] })
			.catch(() => null);

		if (!collected || collected.first().content.toLowerCase() !== "yes") {
			return confirm.edit("Broadcast cancelled.");
		}

		await confirm.edit("Broadcasting...");

		const subs = await client.db.announcements.getSubscribed();
		let sent = 0;
		let failed = 0;
		const BATCH_SIZE = 3;
		const DELAY_MS = 1500;

		for (let i = 0; i < subs.length; i += BATCH_SIZE) {
			const batch = subs.slice(i, i + BATCH_SIZE);

			await Promise.allSettled(
				batch.map(async (sub) => {
					try {
						// Try webhook first
						if (sub.webhookId && sub.webhookToken) {
							try {
								const webhook = await client.fetchWebhook(
									sub.webhookId,
									sub.webhookToken,
								);
								await webhook.send({ content });
								sent++;
								return;
							} catch (webhookErr) {
								log.warn(
									`Webhook failed for ${sub.guildId}, falling back to channel.send: ${webhookErr.message}`,
								);
								// Fall through to channel.send
							}
						}

						// Fallback to channel.send
						const channel = await client.channels.fetch(sub.channelId);
						if (channel?.isTextBased()) {
							await channel.send({ content });
							sent++;
						} else {
							failed++;
						}
					} catch (err) {
						log.error(`Broadcast failed for ${sub.guildId}: ${err.message}`);
						failed++;
					}
				}),
			);

			if (i + BATCH_SIZE < subs.length) {
				await new Promise((r) => setTimeout(r, DELAY_MS));
			}
		}

		await confirm.edit(
			`📢 **Broadcast complete.**\n` +
				`✅ Sent to **${sent}** servers\n` +
				`❌ Failed in **${failed}** servers`,
		);
	},
};
