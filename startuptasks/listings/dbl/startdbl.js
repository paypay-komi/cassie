const { createDjsClient } = require("discordbotlist");
require("dotenv/config");
module.exports = {
	name: "startDbl",
	description: "starts up the dbl posting stats",
	needsReadyClient: true,
	execute(client) {
			if (!process.env.DBL_API_TOKEN) {
			console.warn("[DBL] No DBL_API_TOKEN set — skipping discordbotlist.com integration");
			return;
		}
		const dbl = createDjsClient(process.env.DBL_API_TOKEN, client);
		dbl.startPosting();
		client.dbl = dbl;
	},
};
