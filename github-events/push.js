const { CLIENT_RENEG_LIMIT } = require("tls");

module.exports = {
	name: "push",
	async execute(payload, client) {
		client.owners.forEach((ownerId) => {
			const owner = client.users.cache.get(ownerId);
			if (owner) {
				owner.send(
					`Received push event from GitHub: ${JSON.stringify(payload)}`,
				);
			}
		});
		console.log("Received push event:", payload);
	},
};
