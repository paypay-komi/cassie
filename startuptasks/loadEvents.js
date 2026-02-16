module.exports = {
	name: "loadEvents",
	description: "Load events on startup",
	reloadAble: true,
	execute(client) {
		const reloadEvents = require("../utils/reloadEvents");
		const eventsLoaded = reloadEvents(client);
		console.log(`✅ Events loaded on startup: ${eventsLoaded}`);
	},
};
