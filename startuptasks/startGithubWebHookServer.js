const express = require('express');
const fs = require('fs');
const path = require('path');

let server;
const eventHandlers = new Map();
module.exports = {
	name: 'startGithubWebHookServer',
	reloadAble: true,

	async execute(client) {
		const app = express();
		app.use(express.json());
		this.reloadEvents(client); // Load event handlers on startup
		app.post('/webhook', async (req, res) => {
			const eventName = req.headers['x-github-event'];
			const payload = req.body;

			res.sendStatus(200);
			console.log(`raw data: ${JSON.stringify(payload)}`);
			const handler = eventHandlers.get(eventName);

			if (!handler) {
				console.log(`⚠️ No handler for event: ${eventName}`);
				// create a file in github-events with the name of the event and a template for handling it
				const template = `
	module.exports = {
		name: "${eventName}",
		async execute(payload, client) {
			console.log("Received ${eventName} event:", payload);
		},
	};
			`;
				fs.writeFileSync(
					`${path.join(__dirname, '..', 'github-events', `${eventName}.js`)}`,
					template,
				);
				console.log(
					`📄 Created template handler for ${eventName} event. Please customize it at startuptasks/github-events/${eventName}.js`,
				);
				return;
			}

			try {
				await handler.execute(payload, client);
			} catch (err) {
				console.error('❌ Error handling %s:', eventName, err);
			}
		});

		server = app.listen(3000, () => {
			console.log('🌐 GitHub webhook server running on port 3000');
		});
	},

	async cleanup() {
		if (server) server.close();
	},
	reloadEvents: async function (client) {
		// Reload event handlers
		eventHandlers.clear();
		const eventsPath = path.join(__dirname, '..', 'github-events');
		for (const file of fs.readdirSync(eventsPath)) {
			if (!file.endsWith('.js')) continue;
			delete require.cache[require.resolve(path.join(eventsPath, file))];
			const event = require(path.join(eventsPath, file));
			eventHandlers.set(event.name, event);
		}
		console.log('🔄 GitHub webhook event handlers reloaded.');
	},
};
