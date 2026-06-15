const { PermissionsBitField } = require("discord.js");
const path = require("path");
const fs = require("fs");
const { getLogger } = require("../../../../lib/logger");

module.exports = {
	name: "webserver",
	description: "Hot-reloads the web server (landing page, routes, 404) without restarting the bot.",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],
	parent: "reload",

	async execute(message) {
		const log = getLogger("ReloadWebServer");
		const msg = await message.reply("♻️ Reloading web server...");

		const results = await message.client.shard.broadcastEval(async (client) => {
			const path = require("path");
			const fs = require("fs");
			const tasksPath = path.join(process.cwd(), "startuptasks", "infrastructure", "startWebServer.js");

			// 1. Cleanup OLD web server (before clearing cache so we can close the port)
			const oldTask = require.cache[require.resolve(tasksPath)];
			if (oldTask) {
				const oldExports = oldTask.exports;
				if (typeof oldExports.cleanup === "function") {
					await oldExports.cleanup(client);
				}
			}

			// 2. Clear route module cache
			const routesDir = path.join(process.cwd(), "routes");
			fs.readdirSync(routesDir).filter(f => f.endsWith(".js")).forEach(file => {
				const fullPath = path.join(routesDir, file);
				delete require.cache[require.resolve(fullPath)];
			});

			// 3. Reload the web server startup task (fresh module = fresh app)
			delete require.cache[require.resolve(tasksPath)];
			const task = require(tasksPath);

			if (typeof task.execute === "function") {
				await task.execute(client);
				return { shard: client.shard?.ids[0] ?? 0, ok: true };
			}

			return { shard: client.shard?.ids[0] ?? 0, ok: false };
		});

		const success = results.every(r => r.ok);
		await msg.edit({
			content: success
				? `✅ Web server reloaded across ${results.length} shard(s). Uptime preserved.`
				: `⚠️ Web server reload completed with errors on some shards.`,
		});
	},
};
