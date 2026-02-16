const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("./config.json");
const deploySlashCommands = require("./utils/depolySlashcommands");
const reloadTextcommands = require("./utils/reloadTextcommands");
const reloadSlashcommands = require("./utils/reloadSlashcommands");
const reloadEvents = require("./utils/reloadEvents");

// --------------------------------------------------
// Client Setup
// --------------------------------------------------
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
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
		const task = require(file);
		if (typeof task.execute === "function") {
			console.log(
				`Executing startup task: ${task.name} - ${task.description}`,
			);
			const returnValue = task.execute(client);
			if (returnValue instanceof Promise) {
				returnValue
					.then(() => {
						console.log(`✅ Startup task completed: ${task.name}`);
					})
					.catch((error) => {
						console.error(
							`❌ Error executing startup task ${task.name}:`,
							error,
						);
					});
			} else {
				console.log(`✅ Startup task completed: ${task.name}`);
			}
			console.log(
				`Startup task ${task.name} executed with return value:`,
				returnValue,
			);
		} else {
			console.warn(
				`Startup task ${file} does not export an execute function`,
			);
		}
	}
}
doStartupTasks();
// --------------------------------------------------
// Login
// --------------------------------------------------
client.login(config.token);
