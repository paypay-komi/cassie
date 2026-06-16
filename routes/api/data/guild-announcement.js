const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-announcement",
	method: "get",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const guildId = req.query.guildId;
		if (!guildId) {
			return res.status(400).json({ ok: false, error: "missing guildId" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const row = await db.announcements.get(guildId);

			return res.json({
				ok: true,
				channelId: row.channelId || null,
				optedOut: row.optedOut,
				lastNagged: row.lastNagged,
				subscribed: !!row.channelId,
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
