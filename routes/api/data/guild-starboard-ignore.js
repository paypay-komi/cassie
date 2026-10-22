const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-starboard-ignore",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, emoji, action, targetId, targetType } = req.body || {};
		if (!guildId || !emoji || !action) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const starboard = await db.prisma.starboard.findUnique({
				where: { guildId_emoji: { guildId, emoji } },
			});
			if (!starboard) {
				return res.status(404).json({ ok: false, error: "starboard not found for this emoji" });
			}

			if (action === "add") {
				if (!targetId || !targetType) {
					return res.status(400).json({ ok: false, error: "missing targetId or targetType" });
				}
				const result = await db.prisma.starboardIgnore.upsert({
					where: { starboardId_targetId_targetType: { starboardId: starboard.id, targetId, targetType } },
					create: { starboardId: starboard.id, targetId, targetType },
					update: {},
				});
				return res.json({ ok: true, ignore: result });
			} else if (action === "remove") {
				if (!targetId || !targetType) {
					return res.status(400).json({ ok: false, error: "missing targetId or targetType" });
				}
				await db.prisma.starboardIgnore.delete({
					where: { starboardId_targetId_targetType: { starboardId: starboard.id, targetId, targetType } },
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
