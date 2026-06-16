const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-echo-chamber",
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
			const channels = await db.prisma.echoChannel.findMany({
				where: { guildId },
			});

			const result = await Promise.all(
				channels.map(async (ch) => {
					const pendingCount = await db.prisma.echoMessage.count({
						where: {
							channelId: ch.channelId,
							deliveredAt: null,
						},
					});
					return {
						channelId: ch.channelId,
						echoChance: ch.echoChance ?? 85,
						deleteDelayMin: ch.deleteDelayMin ?? 10000,
						deleteDelayMax: ch.deleteDelayMax ?? 300000,
						echoDelayMin: ch.echoDelayMin ?? 0,
						echoDelayMax: ch.echoDelayMax ?? 86400000,
						pendingCount,
					};
				}),
			);

			return res.json({ ok: true, channels: result });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
