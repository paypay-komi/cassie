const { ShardingManager } = require("discord.js");
const path = require("path");
const config = require("./config.json");

const manager = new ShardingManager(path.join(__dirname, "bot.js"), {
	token: config.token,
	totalShards: "auto",
});

manager.on("shardCreate", (shard) => {
	console.log(`[Main] Launched shard ${shard.id}`);

	const attachLogs = () => {
		if (!shard.process) {
			setTimeout(attachLogs, 50);
			return;
		}

		shard.process.stdout?.on("data", (data) => {
			console.log(`[Shard ${shard.id}] ${data.toString().trim()}`);
		});

		shard.process.stderr?.on("data", (data) => {
			console.error(
				`[Shard ${shard.id} ERROR] ${data.toString().trim()}`,
			);
		});
	};

	attachLogs();
});

manager.spawn();
