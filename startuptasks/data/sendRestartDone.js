const { getLogger } = require("../../lib/logger");
const {
	readPendingEntry,
	clearPendingEntry,
} = require("../../lib/restartPending");
module.exports = {
	name: "sendRestartDone",
	description: "Send 'Restart done' confirmation after a restart",
	needsReadyClient: true,
	shard0Only: true,
	reloadAble: true,
	async execute(client) {
		const log = getLogger("RestartDone");
		const entry = readPendingEntry();
		if (!entry) return;

		clearPendingEntry();

		try {
			const channel = await client.channels.fetch(entry.channelId);
			if (channel?.isTextBased()) {
				await channel.send("✅ Restart done!");
			} else {
				log.warn(
					`Could not find channel ${entry.channelId} to send restart confirmation.`,
				);
			}
		} catch (err) {
			log.error("Failed to send restart confirmation:", err);
		}
	},
};