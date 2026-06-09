const db = require("../../../db");

module.exports = {
	path: "/api/data/guild-check-disabled",
	method: "get",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, commandId } = req.query;
		if (!guildId || !commandId) {
			return res.status(400).json({ ok: false, error: "missing guildId or commandId" });
		}

		try {
			const entry = await db.prisma.guildDisabledCommand.findUnique({
				where: { guildId_commandId: { guildId, commandId } },
			});
			return res.json({ ok: true, disabled: !!entry });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
