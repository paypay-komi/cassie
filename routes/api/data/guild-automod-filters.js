const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");
const { ensureConfig } = require("../../../lib/automod");

module.exports = {
	path: "/api/data/guild-automod-filters",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, action, type, enabled, threshold, whitelisted, blacklisted, punishment, punishmentDuration } = req.body || {};
		if (!guildId || !action || !type) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (action === "add" || action === "toggle") {
				await ensureConfig(db.prisma, guildId);
				const data = {};
				if (enabled !== undefined) data.enabled = !!enabled;
				if (threshold !== undefined) data.threshold = Number(threshold);
				if (whitelisted !== undefined) data.whitelisted = Array.isArray(whitelisted) ? whitelisted : [];
				if (blacklisted !== undefined) data.blacklisted = Array.isArray(blacklisted) ? blacklisted : [];
				if (punishment !== undefined) data.punishment = punishment;
				if (punishmentDuration !== undefined) data.punishmentDuration = Number(punishmentDuration);

				const result = await db.prisma.automodFilter.upsert({
					where: { configId_type: { configId: guildId, type } },
					create: { configId: guildId, type, ...data },
					update: data,
				});
				return res.json({ ok: true, filter: result });
			} else if (action === "remove") {
				await db.prisma.automodFilter.delete({
					where: { configId_type: { configId: guildId, type } },
				});
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
