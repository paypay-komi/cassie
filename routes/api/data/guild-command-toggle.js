const db = require("../../../db");

module.exports = {
	path: "/api/data/guild-command-toggle",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, commandId, disabled } = req.body || {};
		if (!guildId || !commandId) {
			return res.status(400).json({ ok: false, error: "missing guildId or commandId" });
		}

		try {
			await db.commandAccess.setGuildDisabled(guildId, commandId, !!disabled);
			return res.json({ ok: true });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
