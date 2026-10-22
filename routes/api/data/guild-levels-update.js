const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-levels-update",
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
			if (config.channelId !== undefined) data.channelId = config.channelId;
			if (config.textEnabled !== undefined) data.textEnabled = !!config.textEnabled;
			if (config.voiceEnabled !== undefined) data.voiceEnabled = !!config.voiceEnabled;
			if (config.textMultiplier !== undefined) data.textMultiplier = Number(config.textMultiplier);
			if (config.voiceMultiplier !== undefined) data.voiceMultiplier = Number(config.voiceMultiplier);
			if (config.dmLevelUp !== undefined) data.dmLevelUp = !!config.dmLevelUp;
			if (config.stackRoles !== undefined) data.stackRoles = !!config.stackRoles;
			if (config.cardEnabled !== undefined) data.cardEnabled = !!config.cardEnabled;
			if (config.cardBranding !== undefined) data.cardBranding = !!config.cardBranding;
			if (config.decayEnabled !== undefined) data.decayEnabled = !!config.decayEnabled;
			if (config.decayDays !== undefined) data.decayDays = Number(config.decayDays);
			if (config.decayPercent !== undefined) data.decayPercent = Number(config.decayPercent);

			const result = await db.prisma.levelConfig.upsert({
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
