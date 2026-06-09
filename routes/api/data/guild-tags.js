const db = require("../../../db");

module.exports = {
	path: "/api/data/guild-tags",
	method: "get",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const guildId = req.query.guildId;
		if (!guildId) {
			return res.status(400).json({ ok: false, error: "missing guildId" });
		}

		try {
			const tags = await db.prisma.guildTag.findMany({
				where: { guildId },
				orderBy: { name: "asc" },
				select: { name: true, content: true, uses: true, createdAt: true, updatedAt: true },
			});

			return res.json({ ok: true, tags });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
