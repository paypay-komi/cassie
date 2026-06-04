const { getLogger } = require("../lib/logger");

module.exports = {
	name: "ping",
	async execute(payload, client) {
		const log = getLogger("GitHub");
		client.owners.forEach((ownerId) => {
			const owner = client.users.cache.get(ownerId);
			if (owner) {
				owner.send(
					`Received ping event from GitHub: ${JSON.stringify(payload)}`,
				);
			}
		});
		log.info("Received ping event:", payload);
	},
};
