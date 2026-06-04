const fs = require("fs");
const path = require("path");

const eventHandlers = new Map();

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

	console.log("[github] events loaded");
}

function getGitHubEvent(name) {
	return eventHandlers.get(name);
}

module.exports = {
	reloadGitHubEvents,
	getGitHubEvent,
};
