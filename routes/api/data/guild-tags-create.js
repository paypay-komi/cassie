const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-tags-create",
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

		if (name.length > 100) {
			return res.status(400).json({ ok: false, error: "tag name too long (max 100)" });
		}

		try {
			// Check for duplicate
			const existing = await db.prisma.guildTag.findUnique({
				where: { guildId_name: { guildId, name } },
			});
			if (existing) {
				return res.status(409).json({ ok: false, error: "tag already exists" });
			}

			const tag = await db.prisma.guildTag.create({
				data: { guildId, name, content, creatorId: req.session.user.id },
			});

			return res.json({
				ok: true,
				tag: { name: tag.name, content: tag.content, uses: tag.uses, createdAt: tag.createdAt },
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
