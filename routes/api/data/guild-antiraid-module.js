const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-antiraid-module",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, type, enabled, action, threshold, window, maxAgeDays, usernamePatterns } = req.body || {};
		if (!guildId || !type) {
			return res.status(400).json({ ok: false, error: "missing guildId or type" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const data = {};
			if (enabled !== undefined) data.enabled = !!enabled;
			if (action !== undefined) data.action = action;
			if (threshold !== undefined) data.threshold = Number(threshold);
			if (window !== undefined) data.window = Number(window);
			if (maxAgeDays !== undefined) data.maxAgeDays = Number(maxAgeDays);
			if (usernamePatterns !== undefined) data.usernamePatterns = Array.isArray(usernamePatterns) ? usernamePatterns : [];

			const result = await db.prisma.antiraidModule.upsert({
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
