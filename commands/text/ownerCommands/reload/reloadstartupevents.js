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
const path = require("path");

module.exports = {
	name: "startuptasks",
	description: "Reloads the startup tasks.",
	parent: "reload",

	async execute(message) {
		const tasksPath = path.join(process.cwd(), "startuptasks");

		const results = await message.client.shard.broadcastEval(
			async (client, { tasksPath }) => {
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

				const files = walk(tasksPath).filter((f) => f.endsWith(".js"));

				let reloaded = 0;

				for (const file of files) {
					try {
						delete require.cache[require.resolve(file)];
						const task = require(file);

						if (!task?.reloadAble) continue;

						if (typeof task.cleanup === "function") {
							await task.cleanup(client);
						}

						if (typeof task.execute === "function") {
							await task.execute(client);
							reloaded++;
						}
					} catch (err) {
						console.error(
							`Shard ${client.shard.ids[0]} failed:`,
							err,
						);
					}
				}

				return {
					shard: client.shard.ids[0],
					reloaded,
				};
			},
			{
				context: { tasksPath },
			},
		);

		await message.reply({
			content: `✅ Startup tasks reloaded on ${results.length} shard(s).`,
		});
	},
};
