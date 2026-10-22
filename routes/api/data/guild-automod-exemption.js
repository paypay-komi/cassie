const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");
const { ensureConfig } = require("../../../lib/automod");

module.exports = {
	path: "/api/data/guild-automod-exemption",
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
				await ensureConfig(db.prisma, guildId);
				const result = await db.prisma.automodExemption.upsert({
					where: { configId_targetId_targetType: { configId: guildId, targetId, targetType } },
					create: { configId: guildId, targetId, targetType },
					update: {},
				});
				return res.json({ ok: true, exemption: result });
			} else if (action === "remove") {
				if (!targetId || !targetType) {
					return res.status(400).json({ ok: false, error: "missing targetId or targetType" });
				}
				await db.prisma.automodExemption.delete({
					where: { configId_targetId_targetType: { configId: guildId, targetId, targetType } },
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
