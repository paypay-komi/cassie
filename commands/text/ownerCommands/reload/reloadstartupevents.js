const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../../../lib/logger");
const fs = require("fs");
const path = require("path");

module.exports = {

commandId: "52546fdc-31f7-4f21-b6b7-23decf8b0c28",
	name: "startuptasks",
	description: "Reloads the startup tasks.",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	parent: "reload",

	async execute(message) {
		const log = getLogger("ReloadEvents");
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
						if (
							task.shard0Only &&
							client.shard &&
							client.shard.ids[0] !== 0
						) {
							continue;
						}

						if (typeof task.cleanup === "function") {
							await task.cleanup(client);
						}

						if (typeof task.execute === "function") {
							await task.execute(client);
							reloaded++;
						}
					} catch (err) {
						log.error(`Shard ${client.shard.ids[0]} failed:`, err);
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
