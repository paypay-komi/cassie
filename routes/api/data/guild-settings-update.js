const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-settings-update",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, prefix } = req.body || {};
		if (!guildId) {
			return res.status(400).json({ ok: false, error: "missing guildId" });
		}
		if (typeof prefix !== "string" || prefix.length > 10) {
			return res.status(400).json({ ok: false, error: "invalid prefix" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			await db.guild.update(guildId, { prefix });

			return res.json({ ok: true });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
