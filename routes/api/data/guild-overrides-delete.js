const db = require("../../../db");

module.exports = {
	path: "/api/data/guild-overrides-delete",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, type, targetId, commandId } = req.body || {};

		if (!guildId || !type || !targetId || !commandId) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		try {
			if (type === "channel") {
				await db.prisma.guildChannelCommandAccess
					.deleteMany({ where: { guildId, channelId: targetId, commandId } })
					.then(() => null);
			} else if (type === "role") {
				await db.commandAccess.removeRoleAccess(guildId, targetId, commandId);
			} else if (type === "user") {
				await db.commandAccess.removeUserAccess(guildId, targetId, commandId);
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
