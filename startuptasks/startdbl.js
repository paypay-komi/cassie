const { createDjsClient } = require("discordbotlist");
require("dotenv/config");
module.exports = {
	name: "startDbl",
	description: "starts up the dbl posting stats",
	needsReadyClient: true,
	execute(client) {
		const dbl = createDjsClient(process.env.DBL_API_TOKEN, client);
		dbl.startPosting();
		client.dbl = dbl;
	},
};
