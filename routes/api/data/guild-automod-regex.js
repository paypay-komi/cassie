const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");
const { ensureConfig } = require("../../../lib/automod");

module.exports = {
	path: "/api/data/guild-automod-regex",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, action, name, pattern, enabled } = req.body || {};
		if (!guildId || !action) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (action === "add") {
				if (!name || !pattern) {
					return res.status(400).json({ ok: false, error: "missing name or pattern" });
				}
				await ensureConfig(db.prisma, guildId);
				const result = await db.prisma.automodRegex.upsert({
					where: { configId_name: { configId: guildId, name } },
					create: { configId: guildId, name, pattern, enabled: enabled !== undefined ? !!enabled : true },
					update: { pattern, enabled: enabled !== undefined ? !!enabled : undefined },
				});
				return res.json({ ok: true, regex: result });
			} else if (action === "remove") {
				if (!name) {
					return res.status(400).json({ ok: false, error: "missing name" });
				}
				await db.prisma.automodRegex.delete({
					where: { configId_name: { configId: guildId, name } },
				});
				return res.json({ ok: true });
			} else if (action === "toggle") {
				if (!name) {
					return res.status(400).json({ ok: false, error: "missing name" });
				}
				const result = await db.prisma.automodRegex.update({
					where: { configId_name: { configId: guildId, name } },
					data: { enabled: enabled !== undefined ? !!enabled : undefined },
				});
				return res.json({ ok: true, regex: result });
			} else {
				return res.status(400).json({ ok: false, error: "invalid action" });
			}
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
