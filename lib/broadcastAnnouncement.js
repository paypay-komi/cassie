const { getLogger } = require("./logger");

const BATCH_SIZE = 3;
const DELAY_MS = 1500;

/**
 * Send a message to all subscribed guilds via webhook (with fallback to channel.send).
 *
 * @param {import('discord.js').Client} client
 * @param {string} content - The message content to broadcast
 * @returns {Promise<{sent: number, failed: number}>}
 */
async function broadcastAnnouncement(client, content) {
	const log = getLogger("Broadcast");
	const subs = await client.db.announcements.getSubscribed();
	let sent = 0;
	let failed = 0;

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

	return { sent, failed };
}

module.exports = { broadcastAnnouncement };
