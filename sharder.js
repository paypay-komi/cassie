const { ShardingManager, Client, GatewayIntentBits } = require("discord.js");
const path = require("path");
require("dotenv/config");

const GUILDS_PER_SHARD = 4500;

(async () => {
	process.env.MANAGER_START_TIME = String(Date.now());

	const token = process.env.DISCORD_TOKEN;
	if (!token) {
		console.error("DISCORD_TOKEN not set in .env");
		process.exit(1);
	}

	// Scout: quick one-shot to count guilds
	const scout = new Client({ intents: [GatewayIntentBits.Guilds] });
	await scout.login(token);
	await new Promise((resolve) => scout.once("ready", resolve));
	const guildCount = scout.guilds.cache.size;
	await scout.destroy();

	const totalShards = Math.max(1, Math.ceil(guildCount / GUILDS_PER_SHARD));
	console.log(
		`[ShardManager] ${guildCount} guilds → ${totalShards} shard(s) (${GUILDS_PER_SHARD}/shard)`,
	);

	const manager = new ShardingManager(path.join(__dirname, "bot.js"), {
		token,
		totalShards,
	});

	manager.on("shardCreate", (shard) => {
		process.stdout.write(
			`[Shard ${shard.id}/${totalShards - 1}] Launched\n`,
		);

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

		shard.on("message", (message) => {
			if (message?.type === "restartAll") {
				console.log(
					`[ShardManager] Restart requested by shard ${shard.id}, respawning all shards...`,
				);
				manager.respawnAll();
			}
		});
	});

	await manager.spawn({ timeout: -1 });
	console.log("[ShardManager] All shards spawned");
})();
