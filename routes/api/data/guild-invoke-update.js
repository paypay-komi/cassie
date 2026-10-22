const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-invoke-update",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, command, type, content, action } = req.body || {};
		if (!guildId || !command || !type) {
			return res.status(400).json({ ok: false, error: "missing guildId, command, or type" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (action === "delete") {
				await db.prisma.invokeConfig.delete({
					where: { guildId_command_type: { guildId, command, type } },
				});
				return res.json({ ok: true });
			}

			if (!content) {
				return res.status(400).json({ ok: false, error: "missing content" });
			}

			const result = await db.prisma.invokeConfig.upsert({
				where: { guildId_command_type: { guildId, command, type } },
				create: { guildId, command, type, content },
				update: { content },
			});

			return res.json({ ok: true, invoke: result });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
