const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-overrides-list",
	method: "get",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const guildId = req.query.guildId;
		if (!guildId) {
			return res.status(400).json({ ok: false, error: "missing guildId" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const [channels, roles, users] = await Promise.all([
				db.prisma.guildChannelCommandAccess.findMany({
					where: { guildId },
					select: { channelId: true, commandId: true, allowed: true },
				}),
				db.prisma.guildRoleCommandAccess.findMany({
					where: { guildId },
					select: { roleId: true, commandId: true, allowed: true },
				}),
				db.prisma.guildUserCommandAccess.findMany({
					where: { guildId },
					select: { userId: true, commandId: true, allowed: true },
				}),
			]);

			return res.json({
				ok: true,
				channels,
				roles,
				users,
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
