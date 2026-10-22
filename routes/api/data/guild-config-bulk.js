const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-config-bulk",
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

		const config = {};

		const safeQuery = async (key, fn) => {
			try {
				config[key] = await fn();
			} catch (err) {
				console.error(`[guild-config-bulk] ${key}:`, err);
				config[key] = null;
			}
		};

		// Guild stats (prefix, memberCount, etc.)
		await safeQuery("stats", async () => {
			const client = req.app?.locals?.client;
			let memberCount = 0;
			let guildName = "Unknown";
			let guildIcon = null;

			let guild = client?.guilds?.cache?.get(guildId);
			if (!guild && client?.shard) {
				const results = await client.shard.broadcastEval(
					(c, { id }) => {
						const g = c.guilds.cache.get(id);
						if (!g) return null;
						return { memberCount: g.memberCount, name: g.name, icon: g.iconURL() };
					},
					{ context: { id: guildId } },
				);
				const found = results.find((r) => r !== null);
				if (found) guild = found;
			}

			if (guild) {
				memberCount = guild?.memberCount ?? 0;
				guildName = guild?.name ?? "Unknown";
				guildIcon = typeof guild?.iconURL === "function" ? guild.iconURL() : guild?.icon ?? null;
			}

			const settings = await db.guild.get(guildId);
			return { guildName, guildIcon, memberCount, prefix: settings?.prefix || "c." };
		});

		await safeQuery("levelConfig", () =>
			db.prisma.levelConfig.findUnique({ where: { guildId } }),
		);

		await safeQuery("levelRoleRewards", () =>
			db.prisma.levelRoleReward.findMany({ where: { guildId } }),
		);

		await safeQuery("levelMultipliers", () =>
			db.prisma.levelMultiplier.findMany({ where: { guildId } }),
		);

		await safeQuery("levelIgnores", () =>
			db.prisma.levelIgnore.findMany({ where: { guildId } }),
		);

		await safeQuery("levelMilestones", () =>
			db.prisma.levelMilestone.findMany({ where: { guildId } }),
		);

		await safeQuery("starboards", () =>
			db.prisma.starboard.findMany({ where: { guildId }, include: { ignored: true } }),
		);

		await safeQuery("voiceMasterConfig", () =>
			db.prisma.voiceMasterConfig.findUnique({ where: { guildId } }),
		);

		await safeQuery("voiceMasterHubs", () =>
			db.prisma.voiceMasterHub.findMany({ where: { guildId } }),
		);

		await safeQuery("antinukeConfig", () =>
			db.prisma.antinukeConfig.findUnique({ where: { guildId }, include: { modules: true } }),
		);

		await safeQuery("antiraidConfig", () =>
			db.prisma.antiraidConfig.findUnique({ where: { guildId }, include: { modules: true } }),
		);

		await safeQuery("automodConfig", () =>
			db.prisma.automodConfig.findUnique({
				where: { guildId },
				include: { filters: true, regexes: true, exemptions: true, strikeConfig: true },
			}),
		);

		await safeQuery("ticketPanels", () =>
			db.prisma.ticketPanel.findMany({ where: { guildId }, include: { options: true } }),
		);

		await safeQuery("inviteConfig", () =>
			db.prisma.guildInviteConfig.findUnique({ where: { guildId } }),
		);

		await safeQuery("boostConfig", () =>
			db.prisma.guildBoostConfig.findUnique({ where: { guildId } }),
		);

		await safeQuery("jailConfig", () =>
			db.prisma.jailConfig.findUnique({ where: { guildId } }),
		);

		await safeQuery("imuteConfig", () =>
			db.prisma.imuteConfig.findUnique({ where: { guildId } }),
		);

		await safeQuery("rmuteConfig", () =>
			db.prisma.rmuteConfig.findUnique({ where: { guildId } }),
		);

		await safeQuery("invokeConfigs", () =>
			db.prisma.invokeConfig.findMany({ where: { guildId } }),
		);

		await safeQuery("warnPunishments", () =>
			db.prisma.warnPunishment.findMany({ where: { guildId } }),
		);

		return res.json({ ok: true, config });
	},
};
