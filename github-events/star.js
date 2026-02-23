module.exports = {
	name: "star",
	async execute(payload, client) {
		client.owners.forEach((ownerId) => {
			const owner = client.users.cache.get(ownerId);
			if (owner) {
				owner.send(
					`Received star event from GitHub: ${JSON.stringify(payload)}`,
				);
			}
		});
		console.log("Received star event:", payload);
	},
};
