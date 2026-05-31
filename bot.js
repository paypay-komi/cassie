const {
	Client,
	GatewayIntentBits,
	Collection,
	Partials,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv/config");
const { waitUntil } = require("async-wait-until");
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
async function doStartupTasks() {
	const startupTasksPath = path.join(__dirname, "startuptasks");

	const startupTaskFiles = walk(startupTasksPath).filter((file) =>
		file.endsWith(".js"),
	);

	// Reload task modules
	for (const file of startupTaskFiles) {
		delete require.cache[require.resolve(file)];
	}

	// Load tasks
	const startupTasks = startupTaskFiles.map((file) => require(file));

	// Build lookup map
	const taskMap = new Map();

	for (const task of startupTasks) {
		if (!task.name) {
			throw new Error(`Startup task missing name: ${task}`);
		}

		if (typeof task.execute !== "function") {
			throw new Error(`Startup task "${task.name}" missing execute()`);
		}

		taskMap.set(task.name, task);
	}

	// Recursive dependency executor
	async function executeTask(task, visiting = new Set()) {
		// Already running/completed
		if (task.promise) {
			return task.promise;
		}

		// Circular dependency detection
		if (visiting.has(task.name)) {
			throw new Error(
				`Circular dependency detected: ${[...visiting, task.name].join(
					" -> ",
				)}`,
			);
		}

		visiting.add(task.name);

		task.promise = (async () => {
			// Run prerequisites first
			for (const prereqName of task.prerequisites || []) {
				const prereqTask = taskMap.get(prereqName);

				if (!prereqTask) {
					throw new Error(
						`Task "${task.name}" missing prerequisite "${prereqName}"`,
					);
				}

				await executeTask(prereqTask, new Set(visiting));
			}

			// Wait for client if required
			if (task.needsReadyClient) {
				await waitUntil(() => client.isReady());
			}

			console.log(`⏳ Running startup task: ${task.name}`);

			await task.execute(client);

			console.log(`✅ Startup task completed: ${task.name}`);
		})();

		return task.promise;
	}

	// Sort by priority before kickoff
	startupTasks.sort((a, b) => (b.priority || 0) - (a.priority || 0));

	// Run all tasks
	const results = await Promise.allSettled(
		startupTasks.map((task) => executeTask(task)),
	);

	// Log failures
	for (const result of results) {
		if (result.status === "rejected") {
			console.error("❌ Startup task failed:", result.reason);
		}
	}

	return results;
}

doStartupTasks();
// --------------------------------------------------
// Login
// --------------------------------------------------
client.login(process.env.DISCORD_TOKEN);
