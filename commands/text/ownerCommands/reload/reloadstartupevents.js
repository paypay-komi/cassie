const fs = require("fs");
const path = require("path");
function walk(dir) {
	let results = [];
	const list = fs.readdirSync(dir);

	for (const file of list) {
		const fullPath = path.join(dir, file);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory()) {
			results = results.concat(walk(fullPath));
		} else {
			results.push(fullPath);
		}
	}

	return results;
}

module.exports = {
	name: "startuptasks",
	description: "Reloads the startup tasks.",
	parent: "reload",

	async execute(message, client) {
		const tasksPath = path.join(process.cwd(), "startuptasks");

		const files = walk(tasksPath).filter((f) => f.endsWith(".js"));

		for (const file of files) {
			try {
				delete require.cache[require.resolve(file)];
				const task = require(file);

				if (!task?.reloadAble) {
					console.log(
						`⚠️ Startup task ${task.name} is not reloadable. Skipping...`,
					);
					continue;
				}

				if (typeof task.cleanup === "function") {
					await task.cleanup(client);
				}

				if (typeof task.execute === "function") {
					await task.execute(client);
					console.log(
						`✅ Startup task ${task.name} reloaded successfully.`,
					);
				} else {
					console.log(
						`⚠️ Startup task ${task.name} has no execute() function. Skipping...`,
					);
				}
			} catch (err) {
				console.error(
					`❌ Failed to reload startup task at ${file}:`,
					err,
				);
			}
		}
		// idk nwhy this never runs but okay ig
		
		await message.reply("Startup tasks reloaded.");
	},
};
