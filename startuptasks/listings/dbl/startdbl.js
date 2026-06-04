const { getLogger } = require("../../../lib/logger");
const { createDjsClient } = require("discordbotlist");
require("dotenv/config");
module.exports = {
	name: "startDbl",
	description: "starts up the dbl posting stats",
	needsReadyClient: true,
	execute(client) {
		const log = getLogger("DBL");
			if (!process.env.DBL_API_TOKEN) {
			log.warn("[DBL] No DBL_API_TOKEN set — skipping discordbotlist.com integration");
			return;
		}
		const dbl = createDjsClient(process.env.DBL_API_TOKEN, client);
		dbl.startPosting();
		client.dbl = dbl;
	},
};
