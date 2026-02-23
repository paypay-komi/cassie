const { CLIENT_RENEG_LIMIT } = require("tls");

module.exports = {
	name: "push",
	async execute(payload, client) {
		client.owners.forEach((ownerId) => {
			const owner = client.users.cache.get(ownerId);
			if (owner) {
				const pusher = payload.pusher ? payload.pusher.name : "Unknown";
				const repo = payload.repository
					? payload.repository.full_name
					: "Unknown";
				const commits = payload.commits ? payload.commits.length : 0;
				const compareUrl = payload.compare || "N/A";
				owner.send(
					`Received push event from GitHub:\nPusher: ${pusher}\nRepository: ${repo}\nCommits: ${commits}\nCompare URL: ${compareUrl}\nFull Payload: ${JSON.stringify(payload)}`,
				);
				console.log(
					`Sent push event notification to owner ${owner.tag}`,
				);
				console.log(`Received push event: ${JSON.stringify(payload)}`);
			}
		});
		console.log("Received push event:", payload);
	},
};
