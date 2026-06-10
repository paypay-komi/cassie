const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-tag-update",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, name, content } = req.body || {};
		if (!guildId || !name || !content) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			await db.prisma.guildTag.update({
				where: { guildId_name: { guildId, name } },
				data: { content, updatedAt: new Date() },
			});

			return res.json({ ok: true });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
