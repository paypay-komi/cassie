const { getLogger } = require("../../lib/logger");
const tracker = require("../../lib/inviteTracker");

module.exports = {
	name: "initInviteCache",
	description: "Preloads guild invites into memory for invite tracking",
	needsReadyClient: true,
	async execute(client) {
		const log = getLogger("InviteTracker");
		if (!client.inviteCache) client.inviteCache = new Map();

		let total = 0;
		for (const guild of client.guilds.cache.values()) {
			const map = await tracker.refresh(client, guild);
			if (map) total += map.size;
		}

		log.info(
			`✅ Cached ${total} invite(s) across ${client.guilds.cache.size} guild(s)`,
		);
	},
};
