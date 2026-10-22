const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-levels-multiplier",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, action, targetId, targetType, multiplier } = req.body || {};
		if (!guildId || !action) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (action === "add") {
				if (!targetId || !targetType || multiplier === undefined) {
					return res.status(400).json({ ok: false, error: "missing targetId, targetType, or multiplier" });
				}
				const result = await db.prisma.levelMultiplier.upsert({
					where: { guildId_targetId_targetType: { guildId, targetId, targetType } },
					create: { guildId, targetId, targetType, multiplier: Number(multiplier) },
					update: { multiplier: Number(multiplier) },
				});
				return res.json({ ok: true, multiplier: result });
			} else if (action === "remove") {
				if (!targetId || !targetType) {
					return res.status(400).json({ ok: false, error: "missing targetId or targetType" });
				}
				await db.prisma.levelMultiplier.delete({
					where: { guildId_targetId_targetType: { guildId, targetId, targetType } },
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
