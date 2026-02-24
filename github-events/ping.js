module.exports = {
	name: 'ping',
	async execute(payload, client) {
		client.owners.forEach((ownerId) => {
			const owner = client.users.cache.get(ownerId);
			if (owner) {
				owner.send(
					`Received ping event from GitHub: ${JSON.stringify(payload)}`,
				);
			}
		});
		console.log('Received ping event:', payload);
	},
};
