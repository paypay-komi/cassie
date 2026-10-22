const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-warn-punishments",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, action, threshold, punishAction, duration } = req.body || {};
		if (!guildId || !action) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (action === "add" || action === "update") {
				if (threshold === undefined || !punishAction) {
					return res.status(400).json({ ok: false, error: "missing threshold or action" });
				}
				const result = await db.prisma.warnPunishment.upsert({
					where: { guildId_threshold: { guildId, threshold: Number(threshold) } },
					create: {
						guildId,
						threshold: Number(threshold),
						action: punishAction,
						duration: duration !== undefined ? Number(duration) : null,
					},
					update: {
						action: punishAction,
						duration: duration !== undefined ? Number(duration) : undefined,
					},
				});
				return res.json({ ok: true, punishment: result });
			} else if (action === "remove") {
				if (threshold === undefined) {
					return res.status(400).json({ ok: false, error: "missing threshold" });
				}
				await db.prisma.warnPunishment.delete({
					where: { guildId_threshold: { guildId, threshold: Number(threshold) } },
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
