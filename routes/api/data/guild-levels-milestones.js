const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-levels-milestones",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, action, level, coins, roleId } = req.body || {};
		if (!guildId || !action) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (action === "add" || action === "update") {
				if (level === undefined) {
					return res.status(400).json({ ok: false, error: "missing level" });
				}
				const data = {};
				if (coins !== undefined) data.coins = Number(coins);
				if (roleId !== undefined) data.roleId = roleId;
				const result = await db.prisma.levelMilestone.upsert({
					where: { guildId_level: { guildId, level: Number(level) } },
					create: { guildId, level: Number(level), coins: Number(coins || 0), roleId: roleId || null },
					update: data,
				});
				return res.json({ ok: true, milestone: result });
			} else if (action === "remove") {
				if (level === undefined) {
					return res.status(400).json({ ok: false, error: "missing level" });
				}
				await db.prisma.levelMilestone.delete({
					where: { guildId_level: { guildId, level: Number(level) } },
				});
				return res.json({ ok: true });
			} else {
				return res.status(400).json({ ok: false, error: "invalid action" });
			}
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
