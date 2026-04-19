const {
	Client,
	GatewayIntentBits,
	Collection,
	Partials,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("./config.json");

// --------------------------------------------------
// Client Setup
// --------------------------------------------------
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages, // need this
		GatewayIntentBits.DirectMessageReactions, // optional but recommended
	],
	partials: [Partials.Channel], // required for DMs to fire MessageCreate
});
function walk(dir) {
	let results = [];
	const list = fs.readdirSync(dir);
	list.forEach((file) => {
		file = path.join(dir, file);
		const stat = fs.statSync(file);
		if (stat && stat.isDirectory()) {
			results = results.concat(walk(file));
		} else {
			results.push(file);
		}
	});
	return results;
}
function doStartupTasks() {
	const startupTasksPath = path.join(__dirname, "startuptasks");
	const startupTaskFiles = walk(startupTasksPath).filter((file) =>
		file.endsWith(".js"),
	);

	for (const file of startupTaskFiles) {
		delete require.cache[require.resolve(file)];
	}
	const startupTasks = startupTaskFiles
		.map((file) => require(file))
		.sort((a, b) => {
			const a_priority = a.priority || 0;
			const b_priority = b.priority || 0;
			return b_priority - a_priority;
		});

	const taskPromises = startupTasks.map(async (task) => {
		try {
			const returnValue = task.execute(client);
			await returnValue; // ensures async tasks finish
			console.log(`✅ Startup task completed: ${task.name}`);
		} catch (error) {
			console.error(
				`❌ Error executing startup task ${task.name}:`,
				error,
			);
		}
	});
	return Promise.allSettled(taskPromises);
}
doStartupTasks();
// --------------------------------------------------
// Login
// --------------------------------------------------
client.login(config.token);
