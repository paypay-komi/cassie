const { getLogger } = require("../lib/logger");

module.exports = {
	name: "star",
	async execute(payload, client) {
		const log = getLogger("GitHub");
		client.owners.forEach((ownerId) => {
			const owner = client.users.cache.get(ownerId);
			if (owner) {
				const was_deleted = payload.action === "deleted";
				owner.send(
					`Received star event from GitHub:
					\nAction: ${payload.action}\nStarred at: ${
						payload.starred_at
					}\nWas deleted: ${was_deleted}`,
				);
				log.info(`Sent star event notification to owner ${owner.tag}`);
			}
		});
		log.info("Received star event:", payload);
	},
};
