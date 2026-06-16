const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-stats",
	method: "get",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const guildId = req.query.guildId;
		if (!guildId) {
			return res.status(400).json({ ok: false, error: "missing guildId" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const client = req.app?.locals?.client;
			if (!client) {
				return res.status(500).json({ ok: false, error: "client not available" });
			}

			// Get guild info from cache or API
			let guild = client.guilds.cache.get(guildId);
			if (!guild && client.shard) {
				const results = await client.shard.broadcastEval(
					(c, { id }) => {
						const g = c.guilds.cache.get(id);
						if (!g) return null;
						return {
							memberCount: g.memberCount,
							channels: g.channels.cache.size,
							roles: g.roles.cache.size,
							name: g.name,
							icon: g.iconURL(),
						};
					},
					{ context: { id: guildId } },
				);
				const found = results.find((r) => r !== null);
				if (found) guild = found;
			}

			const memberCount = guild?.memberCount ?? 0;
			const channelCount = guild?.channels?.cache?.size ?? guild?.channels ?? 0;
			const roleCount = guild?.roles?.cache?.size ?? guild?.roles ?? 0;
			const guildName = guild?.name ?? "Unknown";
			// guild.icon is a hash string on Guild objects but a full URL when
			// returned from broadcastEval; iconURL() handles both cases.
			const guildIcon =
				typeof guild?.iconURL === "function"
					? guild.iconURL()
					: guild?.icon ?? null;

			// Count total commands used in this guild
			const cmdCount = await db.prisma.userCommandStats.count({
				where: { guildId },
			});

			// Get guild settings for prefix
			const settings = await db.guild.get(guildId);

			// Count disabled commands, overrides, and tags
			let disabledCmdCount = 0;
			let overrideCount = 0;
			let tagCount = 0;
			try {
				disabledCmdCount = await db.prisma.guildDisabledCommand.count({ where: { guildId } });
			} catch {}
			try {
				const [chOv, roleOv, userOv] = await Promise.all([
					db.prisma.guildChannelCommandAccess.count({ where: { guildId } }),
					db.prisma.guildRoleCommandAccess.count({ where: { guildId } }),
					db.prisma.guildUserCommandAccess.count({ where: { guildId } }),
				]);
				overrideCount = chOv + roleOv + userOv;
			} catch {}
			try {
				tagCount = await db.prisma.guildTag.count({ where: { guildId } });
			} catch {}

			return res.json({
				ok: true,
				stats: {
					guildName,
					guildIcon,
					memberCount,
					channelCount,
					roleCount,
					totalCommands: cmdCount,
					disabledCmdCount,
					overrideCount,
					tagCount,
					prefix: settings.prefix || "c.",
				},
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
