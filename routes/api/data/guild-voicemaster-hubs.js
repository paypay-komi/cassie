const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-voicemaster-hubs",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, action, channelId, name } = req.body || {};
		if (!guildId || !action) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (action === "add") {
				if (!channelId || !name) {
					return res.status(400).json({ ok: false, error: "missing channelId or name" });
				}
				const result = await db.prisma.voiceMasterHub.upsert({
					where: { guildId_channelId: { guildId, channelId } },
					create: { guildId, channelId, name },
					update: { name },
				});
				return res.json({ ok: true, hub: result });
			} else if (action === "remove") {
				if (!channelId) {
					return res.status(400).json({ ok: false, error: "missing channelId" });
				}
				await db.prisma.voiceMasterHub.deleteMany({ where: { guildId, channelId } });
				return res.json({ ok: true });
			} else {
				return res.status(400).json({ ok: false, error: "invalid action" });
			}
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
