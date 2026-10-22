const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-voicemaster-update",
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
			if (config.categoryId !== undefined) data.categoryId = config.categoryId;
			if (config.interfaceEnabled !== undefined) data.interfaceEnabled = !!config.interfaceEnabled;
			if (config.defaultBitrate !== undefined) data.defaultBitrate = Number(config.defaultBitrate);
			if (config.defaultName !== undefined) data.defaultName = config.defaultName;
			if (config.defaultRegion !== undefined) data.defaultRegion = config.defaultRegion;
			if (config.defaultRoleId !== undefined) data.defaultRoleId = config.defaultRoleId;
			if (config.temporary !== undefined) data.temporary = !!config.temporary;

			const result = await db.prisma.voiceMasterConfig.upsert({
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
