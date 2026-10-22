const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-levels-role-rewards",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, action, roleId, level } = req.body || {};
		if (!guildId || !action) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (action === "add") {
				if (!roleId || level === undefined) {
					return res.status(400).json({ ok: false, error: "missing roleId or level" });
				}
				const result = await db.prisma.levelRoleReward.upsert({
					where: { guildId_level: { guildId, level: Number(level) } },
					create: { guildId, roleId, level: Number(level) },
					update: { roleId },
				});
				return res.json({ ok: true, reward: result });
			} else if (action === "remove") {
				if (level === undefined) {
					return res.status(400).json({ ok: false, error: "missing level" });
				}
				await db.prisma.levelRoleReward.delete({
					where: { guildId_level: { guildId, level: Number(level) } },
				});
				return res.json({ ok: true });
			} else if (action === "clear") {
				await db.prisma.levelRoleReward.deleteMany({ where: { guildId } });
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
