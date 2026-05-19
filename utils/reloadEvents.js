const { Client } = require("discord.js");
const fs = require("fs");
const path = require("path");

/**
 * @param {Client} client
 */
module.exports = function reloadEvents(client) {
	const eventsPath = path.join(__dirname, "../events");
	const files = fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js"));

	client.__eventListeners = client.__eventListeners || [];

	// Remove old listeners safely (WITH LOGS)
	for (const { event, listener } of client.__eventListeners) {
		client.removeListener(event, listener);
		console.log(`🧹 Unloaded event: ${event}`);
	}

	client.__eventListeners = [];

	// Load events again
	for (const file of files) {
		const filePath = path.join(eventsPath, file);

		try {
			delete require.cache[require.resolve(filePath)];

			const event = require(filePath);

			if (!event?.name || typeof event.execute !== "function") {
				console.warn(`⚠️ Invalid event file: ${file}`);
				continue;
			}

			const listener = (...args) => event.execute(client, ...args);

			if (event.once) {
				client.once(event.name, listener);
			} else {
				client.on(event.name, listener);
			}

			client.__eventListeners.push({
				event: event.name,
				listener,
			});

			console.log(`✓ Loaded event: ${event.name} (${file})`);
		} catch (err) {
			console.error(`❌ Failed loading event ${file}:`, err);
		}
	}

	console.log(`\n📦 Reloaded ${files.length} events\n`);
};
