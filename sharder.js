const { ShardingManager } = require("discord.js");
const path = require("path");
require("dotenv/config");

const manager = new ShardingManager(path.join(__dirname, "bot.js"), {
	token: process.env.DISCORD_TOKEN,
	totalShards: "auto",
});

manager.on("shardCreate", (shard) => {
	process.stdout.write(`[Shard ${shard.id}] Launched\n`);

	const attachLogs = () => {
		if (!shard.process) {
			setTimeout(attachLogs, 50);
			return;
		}

		shard.process.stdout?.on("data", (data) => {
			process.stdout.write(`[Shard ${shard.id}] ${data}`);
		});

		shard.process.stderr?.on("data", (data) => {
			process.stderr.write(`[Shard ${shard.id} ERROR] ${data}`);
		});
	};

	attachLogs();
});

manager.spawn();
