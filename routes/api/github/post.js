const fs = require("fs");
const path = require("path");
const { getGitHubEvent } = require("../../../utils/githubEvents");

module.exports = {
	path: "/webhook/github",
	method: "post",

	middleware: [
		require("express").json(),
	],

	handler: async (req, res) => {
		const eventName = req.headers["x-github-event"];
		const payload = req.body;

		res.sendStatus(200);

		console.log(`[github] event ${eventName}`);

		const handler = getGitHubEvent(eventName);

		if (!handler) {
			console.warn(`[github] missing handler ${eventName}`);

			const template = `
module.exports = {
	name: "${eventName}",
	async execute(payload, client) {
		console.log("github ${eventName}", payload);
	},
};
			`;

			const filePath = path.join(
				process.cwd(),
				"github-events",
				`${eventName}.js`
			);

			fs.writeFileSync(filePath, template);

			console.log(`[github] created handler ${eventName}`);
			return;
		}

		try {
			await handler.execute(payload, req.client);
		} catch (err) {
			console.error(`[github] handler crash ${eventName}`, err);
		}
	},
};
