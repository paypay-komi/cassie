const fs = require("fs");
const path = require("path");
const { getLogger } = require("../lib/logger");

const eventHandlers = new Map();
const log = getLogger("GitHubEvents");

function reloadGitHubEvents() {
	eventHandlers.clear();

	const eventsPath = path.join(process.cwd(), "github-events");
	const files = fs.readdirSync(eventsPath);

	for (const file of files) {
		if (!file.endsWith(".js")) continue;

		const full = path.join(eventsPath, file);
		delete require.cache[require.resolve(full)];

		const event = require(full);
		eventHandlers.set(event.name, event);
	}

	log.info("[github] events loaded");
}

function getGitHubEvent(name) {
	return eventHandlers.get(name);
}

module.exports = {
	reloadGitHubEvents,
	getGitHubEvent,
};
