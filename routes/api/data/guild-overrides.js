const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-overrides",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, type, targetId, commandId, allowed } = req.body || {};

		if (!guildId || !type || !targetId || !commandId) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (type === "channel") {
				await db.commandAccess.setChannelAccess(guildId, targetId, commandId, !!allowed);
			} else if (type === "role") {
				await db.commandAccess.setRoleAccess(guildId, targetId, commandId, !!allowed);
			} else if (type === "user") {
				await db.commandAccess.setUserAccess(guildId, targetId, commandId, !!allowed);
			} else {
				return res.status(400).json({ ok: false, error: "invalid type" });
			}

			return res.json({ ok: true });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
