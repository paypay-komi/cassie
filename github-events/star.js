module.exports = {
	name: "star",
	async execute(payload, client) {
		client.owners.forEach((ownerId) => {
			const owner = client.users.cache.get(ownerId);
			if (owner) {
				const was_deleted = payload.action === "deleted";
				owner.send(
					`Received star event from GitHub: ${JSON.stringify(
						payload,
					)}\nAction: ${payload.action}\nStarred at: ${
						payload.starred_at
					}\nWas deleted: ${was_deleted}`,
				);
				console.log(
					`Sent star event notification to owner ${owner.tag}`,
				);
			}
		});
		console.log("Received star event:", payload);
	},
};
