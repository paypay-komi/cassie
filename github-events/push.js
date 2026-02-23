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
				const commitMessages = payload.commits
					? payload.commits
							.map((c) => `- ${c.message} (${c.url})`)
							.join("\n")
					: "No commits";

				owner.send(
					`Received push event from GitHub:\nPusher: ${pusher}\nRepository: ${repo}\nCommits: ${commits}\nCompare URL: ${compareUrl}\nCommit Messages:\n${commitMessages}`,
				);
				console.log(
					`Sent push event notification to owner ${owner.tag}`,
				);
			}
		});
		console.log("Received push event:", payload);
	},
};
