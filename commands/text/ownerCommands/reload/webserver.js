const { PermissionsBitField } = require("discord.js");
const path = require("path");
const fs = require("fs");
const { getLogger } = require("../../../../lib/logger");

function walk(dir) {
	const entries = fs.readdirSync(dir);
	let out = [];
	for (const entry of entries) {
		const full = path.join(dir, entry);
		if (fs.statSync(full).isDirectory()) {
			out = out.concat(walk(full));
		} else if (entry.endsWith(".js")) {
			out.push(full);
		}
	}
	return out;
}

module.exports = {

commandId: "744a5d6e-b306-4028-b4c5-1f53ebff8e25",
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

			function walk(dir) {
				const entries = fs.readdirSync(dir);
				let out = [];
				for (const entry of entries) {
					const full = path.join(dir, entry);
					if (fs.statSync(full).isDirectory()) {
						out = out.concat(walk(full));
					} else if (entry.endsWith(".js")) {
						out.push(full);
					}
				}
				return out;
			}

			const tasksPath = path.join(process.cwd(), "startuptasks", "infrastructure", "startWebServer.js");

			// 1. Cleanup OLD web server (before clearing cache so we can close the port)
			const oldTask = require.cache[require.resolve(tasksPath)];
			if (oldTask) {
				const oldExports = oldTask.exports;
				if (typeof oldExports.cleanup === "function") {
					await oldExports.cleanup(client);
				}
			}

			// 2. Clear ALL route module caches recursively
			const routesDir = path.join(process.cwd(), "routes");
			for (const filePath of walk(routesDir)) {
				delete require.cache[require.resolve(filePath)];
			}

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
