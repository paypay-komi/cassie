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

	// Restart confirmation memory: survives respawnAll because the manager
	// process itself stays alive across shard restarts.
	let pendingRestartConfirm = null;
	let waitingForReady = false;
	let readyShardCount = 0;

	// Discord's guild→shard mapping: shard_id = (guild_id >> 22) % totalShards
	function shardIdForGuild(guildId) {
		if (!guildId) return null;
		const big = BigInt(guildId);
		const shard = (big >> 22n) % BigInt(totalShards);
		return Number(shard);
	}

	async function sendRestartConfirm(confirm, targetShardId) {
		try {
			await manager.broadcastEval(
				(client, ctx) => {
					return client.channels
						.fetch(ctx.channelId)
						.then((ch) => {
							if (!ch || !ch.isTextBased()) return "missing";
							return ch.send("✅ Restart done!").then(() => "sent");
						})
						.catch(() => "error");
				},
				{
					context: {
						channelId: confirm.channelId,
						userId: confirm.userId,
					},
					shard: targetShardId,
				},
			);
		} catch (err) {
			console.error(
				"[ShardManager] Failed to send restart confirmation:",
				err,
			);
		}
	}

	function fireConfirmIfReady() {
		if (!waitingForReady || !pendingRestartConfirm) return;
		if (readyShardCount < manager.shards.size) return;

		const pending = pendingRestartConfirm;
		pendingRestartConfirm = null;
		waitingForReady = false;
		readyShardCount = 0;

		// Route to the shard that owns the guild (only it has that guild).
		const guildShard = shardIdForGuild(pending.confirm.guildId);
		const targetShard =
			guildShard !== null ? guildShard : pending.originShardId;
		sendRestartConfirm(pending.confirm, targetShard);
	}

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
				const confirm = message.confirm || null;
				pendingRestartConfirm = { confirm, originShardId: shard.id };
				waitingForReady = true;
				readyShardCount = 0;
				manager.respawnAll().catch((err) => {
					console.error(
						"[ShardManager] respawnAll failed:",
						err,
					);
					pendingRestartConfirm = null;
					waitingForReady = false;
				});
			}
		});

		shard.on("ready", () => {
			process.stdout.write(
				`[Shard ${shard.id}/${totalShards - 1}] Ready\n`,
			);
			if (waitingForReady) {
				readyShardCount++;
				fireConfirmIfReady();
			}
		});

		// Fallback: if a shard fails to come back, don't leave the
		// confirmation stuck — blast it to whatever is already up.
		shard.on("error", () => {
			if (waitingForReady && pendingRestartConfirm) {
				const pending = pendingRestartConfirm;
				pendingRestartConfirm = null;
				waitingForReady = false;
				readyShardCount = 0;
				const guildShard = shardIdForGuild(pending.confirm.guildId);
				const targetShard =
					guildShard !== null ? guildShard : pending.originShardId;
				sendRestartConfirm(pending.confirm, targetShard);
			}
		});
	});

	await manager.spawn({ timeout: -1 });
	console.log("[ShardManager] All shards spawned");
})();
