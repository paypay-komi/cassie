const {
	PermissionsBitField,
	EmbedBuilder,
	version: djsVersion,
} = require("discord.js");
const os = require("os");

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
	aliases: ["stats", "about", "status"],
	description: "Show bot statistics and status.",

	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.EmbedLinks,
	],

	category: {
		name: "Bot",
		emoji: "🤖",
		description: "Bot information and configuration.",
		order: 10,
	},

	async execute(message, args) {
		const client = message.client;

		const isSharded = !!client.shard;
		const shardId = client.shard?.ids?.[0] ?? 0;
		const totalShards = client.shard?.count ?? 1;

		const botUser = client.user;

		let totalGuilds;
		let totalUsers;
		let totalChannels;

		// ----- shard stats -----
		if (isSharded) {
			const shardStats = await client.shard.broadcastEval((c) => ({
				guilds: c.guilds.cache.size,
				users: c.guilds.cache.reduce(
					(total, guild) => total + guild.memberCount,
					0,
				),
				channels: c.channels.cache.size,
			}));

			totalGuilds = shardStats.reduce(
				(total, shard) => total + shard.guilds,
				0,
			);

			totalUsers = shardStats.reduce(
				(total, shard) => total + shard.users,
				0,
			);

			totalChannels = shardStats.reduce(
				(total, shard) => total + shard.channels,
				0,
			);
		} else {
			totalGuilds = client.guilds.cache.size;

			totalUsers = client.guilds.cache.reduce(
				(total, guild) => total + guild.memberCount,
				0,
			);

			totalChannels = client.channels.cache.size;
		}

		// ----- database -----
		const dbStart = Date.now();

		await client.db.prisma.$queryRaw`SELECT 1`;

		const dbPing = Date.now() - dbStart;

		// ----- command stats -----
		const cmdCount = await client.db.stats.getTotalExecutions();

		// ----- uptime -----
		const mgrStart = process.env.MANAGER_START_TIME;

		const uptimeMs = mgrStart
			? Date.now() - Number(mgrStart)
			: client.readyAt
				? Date.now() - client.readyAt.getTime()
				: 0;

		const uptimeStr = uptimeMs ? msToTime(uptimeMs) : "N/A";

		// ----- memory -----
		const mem = process.memoryUsage();

		const rss = (mem.rss / 1024 / 1024).toFixed(1);
		const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(1);
		const heapTotal = (mem.heapTotal / 1024 / 1024).toFixed(1);

		const totalRam = os.totalmem();

		const memoryPercent = ((mem.rss / totalRam) * 100).toFixed(1);

		// ----- cpu -----
		const cpuUsage = process.cpuUsage();

		const cpuTime = ((cpuUsage.user + cpuUsage.system) / 1_000_000).toFixed(
			2,
		);

		// ----- versions -----
		const nodeVer = process.version;

		// ----- command count -----
		let commandCount = 0;

		function countCmds(tree) {
			for (const cmd of tree.values()) {
				if (cmd.execute) commandCount++;

				if (cmd.subcommands instanceof Map) {
					countCmds(cmd.subcommands);
				} else if (cmd.subcommands) {
					countCmds(new Map(Object.entries(cmd.subcommands)));
				}
			}
		}

		countCmds(client.textCommands || new Map());

		// ----- misc -----
		const createdTimestamp = Math.floor(botUser.createdTimestamp / 1000);

		const avgServersPerShard = (totalGuilds / totalShards).toFixed(1);

		const messagesProcessed = client.stats?.messages ?? 0;

		const embed = new EmbedBuilder()
			.setTitle(`${botUser.username} — Bot Statistics`)
			.setThumbnail(botUser.displayAvatarURL())
			.setColor(0x57f287)
			.addFields(
				{
					name: "Servers",
					value: totalGuilds.toLocaleString(),
					inline: true,
				},
				{
					name: "Users",
					value: totalUsers.toLocaleString(),
					inline: true,
				},
				{
					name: "Channels",
					value: totalChannels.toLocaleString(),
					inline: true,
				},
				{
					name: "Commands",
					value: commandCount.toLocaleString(),
					inline: true,
				},
				{
					name: "Commands Ran",
					value: cmdCount.toLocaleString(),
					inline: true,
				},
				{
					name: "Uptime",
					value: uptimeStr,
					inline: true,
				},
				{
					name: "API Ping",
					value: `${Math.round(client.ws.ping)}ms`,
					inline: true,
				},
				{
					name: "Database",
					value: `${dbPing}ms`,
					inline: true,
				},
				{
					name: "Memory",
					value: `${rss}MB / ${(totalRam / 1024 / 1024).toFixed(0)}MB (${memoryPercent}%)`,
					inline: true,
				},
				{
					name: "Heap",
					value: `${heapUsed}MB / ${heapTotal}MB`,
					inline: true,
				},
				{
					name: "CPU Time ",
					value: `${cpuTime}s (since shard start/restart)`,
					inline: true,
				},
				{
					name: "Shard",
					value: `${shardId + 1} / ${totalShards}`,
					inline: true,
				},
				{
					name: "Avg Servers/Shard",
					value: avgServersPerShard,
					inline: true,
				},
				{
					name: "Cached Users",
					value: client.users.cache.size.toLocaleString(),
					inline: true,
				},
				{
					name: "Emojis",
					value: client.emojis.cache.size.toLocaleString(),
					inline: true,
				},
				{
					name: "Created",
					value: `<t:${createdTimestamp}:R>`,
					inline: true,
				},
				{
					name: "Node.js",
					value: nodeVer,
					inline: true,
				},
				{
					name: "Discord.js",
					value: `v${djsVersion}`,
					inline: true,
				},
				{
					name: "Invite",
					value: `[Add ${botUser.username}](https://nekomi.tailef6033.ts.net/invite?ref=bot%20stats%20embed) (if this link does not work then the website may be down atm I'm sorry)`,
					inline: false,
				},
			)
			.setFooter({
				text: `ID: ${botUser.id}`,
			})
			.setTimestamp();

		message.reply({
			embeds: [embed],
		});
	},
};
