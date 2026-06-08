const { PermissionsBitField, EmbedBuilder, version: djsVersion } = require("discord.js");

function msToTime(ms) {
	const days = Math.floor(ms / 86_400_000);
	ms -= days * 86_400_000;
	const hours = Math.floor(ms / 3_600_000);
	ms -= hours * 3_600_000;
	const minutes = Math.floor(ms / 60_000);
	const seconds = Math.floor((ms % 60_000) / 1000);
	const parts = [];
	if (days) parts.push(`${days}d`);
	if (hours) parts.push(`${hours}h`);
	parts.push(`${minutes}m`);
	parts.push(`${seconds}s`);
	return parts.join(" ");
}

module.exports = {

commandId: "b7d9f3e1-6a2c-4f8b-9d0e-5c1a7b3d2f8e",
	name: "botstats",
	aliases: ["stats", "about"],
	description: "Show bot statistics and status.",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.EmbedLinks,
	],
	category: "Utility",

	async execute(message, args) {
		const client = message.client;
		const isSharded = !!client.shard;
		const shardId = client.shard?.ids?.[0] ?? 0;
		const totalShards = client.shard?.count ?? 1;

		// ----- bot info -----
		const botUser = client.user;

		let totalGuilds, totalUsers, totalChannels;
		if (isSharded) {
			const [guildCounts, userCounts, channelCounts] = await Promise.all([
				client.shard.broadcastEval((c) => c.guilds.cache.size),
				client.shard.broadcastEval((c) => c.guilds.cache.reduce((t, g) => t + g.memberCount, 0)),
				client.shard.broadcastEval((c) => c.channels.cache.size),
			]);
			totalGuilds = guildCounts.reduce((a, b) => a + b, 0);
			totalUsers = userCounts.reduce((a, b) => a + b, 0);
			totalChannels = channelCounts.reduce((a, b) => a + b, 0);
		} else {
			totalGuilds = client.guilds.cache.size;
			totalUsers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
			totalChannels = client.channels.cache.size;
		}

		// ----- uptime -----
		const uptimeMs = client.readyAt ? Date.now() - client.readyAt.getTime() : 0;
		const uptimeStr = uptimeMs ? msToTime(uptimeMs) : "N/A";

		// ----- ping -----
		const apiPing = Math.round(client.ws.ping);

		// ----- memory -----
		const mem = process.memoryUsage();
		const rss = (mem.rss / 1024 / 1024).toFixed(1);
		const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(1);
		const heapTotal = (mem.heapTotal / 1024 / 1024).toFixed(1);

		// ----- versions -----
		const nodeVer = process.version;
		const pkg = require("../../../package.json");

		// ----- command count -----
		let commandCount = 0;
		function countCmds(tree) {
			for (const cmd of tree.values()) {
				if (cmd.execute) commandCount++;
				if (cmd.subcommands) countCmds(new Map(Object.entries(cmd.subcommands)));
			}
		}
		countCmds(client.textCommands || new Map());

		// ----- embed -----
		const embed = new EmbedBuilder()
			.setTitle(`${botUser.username} — Bot Statistics`)
			.setThumbnail(botUser.displayAvatarURL())
			.setColor(0x57F287)
			.addFields(
				{ name: "Servers", value: totalGuilds.toLocaleString(), inline: true },
				{ name: "Users", value: totalUsers.toLocaleString(), inline: true },
				{ name: "Channels", value: totalChannels.toLocaleString(), inline: true },
				{ name: "Commands", value: String(commandCount), inline: true },
				{ name: "Uptime", value: uptimeStr, inline: true },
				{ name: "API Ping", value: `${apiPing}ms`, inline: true },
				{ name: "Memory (RSS)", value: `${rss} MB`, inline: true },
				{ name: "Heap", value: `${heapUsed} MB / ${heapTotal} MB`, inline: true },
				{ name: "Shard", value: `${shardId} / ${totalShards}`, inline: true },
				{ name: "Node.js", value: nodeVer, inline: true },
				{ name: "Discord.js", value: `v${djsVersion}`, inline: true },
				{ name: "Bot Version", value: `v${pkg.version || "?"}`, inline: true },
			)
			.setFooter({ text: `ID: ${botUser.id}` })
			.setTimestamp();

		message.reply({ embeds: [embed] });
	},
};
