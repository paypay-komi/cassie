const { getLogger } = require("../../lib/logger");

module.exports = {
	name: "loadEvents",
	description: "Load events on startup",
	execute(client) {
		const log = getLogger("LoadEvents");
		const reloadEvents = require("../../utils/reloadEvents");
		const eventsLoaded = reloadEvents(client);
		log.info(`✅ Events loaded on startup: ${eventsLoaded}`);
	},
};
