const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-antiraid-update",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, config, whitelisted } = req.body || {};
		if (!guildId) {
			return res.status(400).json({ ok: false, error: "missing guildId" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const data = {};
			if (config?.enabled !== undefined) data.enabled = !!config.enabled;
			if (config?.lockdown !== undefined) data.lockdown = !!config.lockdown;
			if (whitelisted !== undefined) data.whitelisted = Array.isArray(whitelisted) ? whitelisted : [];

			const result = await db.prisma.antiraidConfig.upsert({
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
