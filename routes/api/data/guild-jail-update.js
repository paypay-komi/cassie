const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-jail-update",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, config } = req.body || {};
		if (!guildId) {
			return res.status(400).json({ ok: false, error: "missing guildId" });
		}
		if (!config || typeof config !== "object") {
			return res.status(400).json({ ok: false, error: "missing config" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const data = {};
			if (config.enabled !== undefined) data.enabled = !!config.enabled;
			if (config.roleId !== undefined) data.roleId = config.roleId;
			if (config.channelId !== undefined) data.channelId = config.channelId;
			if (config.categoryId !== undefined) data.categoryId = config.categoryId;
			if (config.logChannelId !== undefined) data.logChannelId = config.logChannelId;

			const result = await db.prisma.jailConfig.upsert({
				where: { guildId },
				create: { guildId, ...data },
				update: data,
			});

			return res.json({ ok: true, config: result });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
