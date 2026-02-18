module.exports = {
	name: "startuptasks",
	description: "Reloads the startup tasks.",
	parent: "reload",
	async execute(message, client) {
		const files = walk("../../../../startuptasks");
		for (const file of files) {
			delete require.cache[require.resolve(file)];
			const task = require(file);
			if (!task?.reloadAble) {
				console.log(
					`⚠️ Startup task ${task.name} is not reloadable. Skipping...`,
				);
				continue;
			}
			if (typeof task.cleanup === "function") {
				task.cleanup(client);
			}
			if (typeof task.execute === "function") {
				await task.execute(client);
				console.log(
					`✅ Startup task ${task.name} reloaded successfully.`,
				);
			} else {
				console.log(
					`⚠️ Startup task ${task.name} does not have an execute function. Skipping...`,
				);
			}
		}
	},
};
function walk(dir) {
	let results = [];
	const list = fs.readdirSync(dir);
	list.forEach((file) => {
		file = path.resolve(dir, file);
		const stat = fs.statSync(file);
		if (stat && stat.isDirectory()) {
			results = results.concat(walk(file));
		} else {
			results.push(file);
		}
	});
	return results;
}
