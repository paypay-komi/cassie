const db = require("../../../db");

module.exports = {
	path: "/api/data/guild-settings",
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
			const settings = await db.guild.get(guildId);

			return res.json({
				ok: true,
				prefix: settings.prefix || "c.",
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
