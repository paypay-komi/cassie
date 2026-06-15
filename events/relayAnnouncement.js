const { Events } = require("discord.js");
const { getLogger } = require("../lib/logger");
const { broadcastAnnouncement } = require("../lib/broadcastAnnouncement");
const config = require("../config.json");

/** The announcement channel where bot owners post messages to relay to all subscribed guilds */
const SOURCE_CHANNEL_ID = "1500553286527352862";

module.exports = {
	name: Events.MessageCreate,
	async execute(client, message) {
		// Only process messages from the source announcement channel
		if (message.channel.id !== SOURCE_CHANNEL_ID || message.author.bot) {
			return;
		}

		// Only bot owners can trigger broadcasts
		if (!config.owners.includes(message.author.id)) return;

		const log = getLogger("RelayAnnouncement");
		const content = message.content.trim();
		if (!content) return;

		log.info(
			`Relaying announcement from ${message.author.tag} in ${message.channel.name}`,
		);

		const { sent, failed } = await broadcastAnnouncement(client, content);

		// React to confirm it was sent
		await message.react("📢").catch(() => {});

		log.info(`Broadcast complete: ${sent} sent, ${failed} failed`);
	},
};
