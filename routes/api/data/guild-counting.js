const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-counting",
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
			const config = await db.prisma.countingConfig.findUnique({ where: { guildId } });
			const scores = await db.prisma.countingScore.findMany({
				where: { guildId },
				orderBy: { score: "desc" },
				take: 10,
			});

			return res.json({
				ok: true,
				config: config ? {
					...config,
					currentCount: config.currentCount.toString(),
					highScore: config.highScore.toString(),
				} : null,
				leaderboard: scores.map(s => ({
					...s,
					score: s.score.toString(),
				})),
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};