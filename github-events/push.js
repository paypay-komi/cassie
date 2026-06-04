const { getLogger } = require("../lib/logger");

module.exports = {
	name: "push",
	async execute(payload, client) {
		const log = getLogger("GitHub");
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

				owner
					.send(
						`Received push event from GitHub:\nPusher: ${pusher}\nRepository: ${repo}\nCommits: ${commits}\nCompare URL: ${compareUrl}\nCommit Messages:\n${commitMessages}`,
					)
					.catch((err) =>
						log.error("Failed to send push notification:", err),
					);
				log.info(`Sent push event notification to owner ${owner.tag}`);
			}
		});
		log.info("Received push event:", payload);
	},
};
