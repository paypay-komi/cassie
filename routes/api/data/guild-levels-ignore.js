const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-levels-ignore",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, action, targetId, targetType } = req.body || {};
		if (!guildId || !action) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (action === "add") {
				if (!targetId || !targetType) {
					return res.status(400).json({ ok: false, error: "missing targetId or targetType" });
				}
				const result = await db.prisma.levelIgnore.upsert({
					where: { guildId_targetId_targetType: { guildId, targetId, targetType } },
					create: { guildId, targetId, targetType },
					update: {},
				});
				return res.json({ ok: true, ignore: result });
			} else if (action === "remove") {
				if (!targetId || !targetType) {
					return res.status(400).json({ ok: false, error: "missing targetId or targetType" });
				}
				await db.prisma.levelIgnore.delete({
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
