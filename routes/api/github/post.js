const fs = require("fs");
const path = require("path");
const { getLogger } = require("../../../lib/logger");
const { getGitHubEvent } = require("../../../utils/githubEvents");

module.exports = {
	path: "/webhook/github",
	method: "post",

	middleware: [
		require("express").json(),
	],

	handler: async (req, res) => {
		const log = getLogger("GitHubWebhook");
		const eventName = req.headers["x-github-event"];
		const payload = req.body;

		res.sendStatus(200);

		log.info(`Event: ${eventName}`);

		const handler = getGitHubEvent(eventName);

		if (!handler) {
			log.warn(`Missing handler for ${eventName}`);

			const template = `
module.exports = {
	name: "${eventName}",
	async execute(payload, client) {
		const { getLogger } = require("../lib/logger");
		getLogger("GitHub").info("Received ${eventName} event:", payload);
	},
};
			`;

			const filePath = path.join(
				process.cwd(),
				"github-events",
				`${eventName}.js`
			);

			fs.writeFileSync(filePath, template);

			log.info(`Created handler for ${eventName}`);
			return;
		}

		try {
			await handler.execute(payload, req.client);
		} catch (err) {
			log.error(`Handler crash for ${eventName}:`, err);
		}
	},
};
