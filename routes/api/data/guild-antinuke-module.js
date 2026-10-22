const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-antinuke-module",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, type, enabled, punishment, punishmentDuration, logChannelId, threshold, window } = req.body || {};
		if (!guildId || !type) {
			return res.status(400).json({ ok: false, error: "missing guildId or type" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const data = {};
			if (enabled !== undefined) data.enabled = !!enabled;
			if (punishment !== undefined) data.punishment = punishment;
			if (punishmentDuration !== undefined) data.punishmentDuration = Number(punishmentDuration);
			if (logChannelId !== undefined) data.logChannelId = logChannelId;
			if (threshold !== undefined) data.threshold = Number(threshold);
			if (window !== undefined) data.window = Number(window);

			const result = await db.prisma.antinukeModule.upsert({
				where: { configId_type: { configId: guildId, type } },
				create: { configId: guildId, type, ...data },
				update: data,
			});

			return res.json({ ok: true, module: result });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
