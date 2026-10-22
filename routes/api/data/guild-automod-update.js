const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-automod-update",
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
			if (config.logChannelId !== undefined) data.logChannelId = config.logChannelId;
			if (config.punishment !== undefined) data.punishment = config.punishment;
			if (config.punishmentDuration !== undefined) data.punishmentDuration = Number(config.punishmentDuration);
			if (config.strikesEnabled !== undefined) data.strikesEnabled = !!config.strikesEnabled;
			if (config.maxStrikes !== undefined) data.maxStrikes = Number(config.maxStrikes);
			if (config.strikeDecayHours !== undefined) data.strikeDecayHours = Number(config.strikeDecayHours);

			const result = await db.prisma.automodConfig.upsert({
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
