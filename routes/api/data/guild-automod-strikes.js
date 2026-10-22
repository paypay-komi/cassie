const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");
const { ensureConfig } = require("../../../lib/automod");

module.exports = {
	path: "/api/data/guild-automod-strikes",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, action, strikes, strikeAction, duration } = req.body || {};
		if (!guildId || !action) {
			return res.status(400).json({ ok: false, error: "missing required fields" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (action === "add" || action === "update") {
				if (strikes === undefined || !strikeAction) {
					return res.status(400).json({ ok: false, error: "missing strikes or action" });
				}
				await ensureConfig(db.prisma, guildId);
				const result = await db.prisma.automodStrikeConfig.upsert({
					where: { configId_strikes: { configId: guildId, strikes: Number(strikes) } },
					create: {
						configId: guildId,
						strikes: Number(strikes),
						action: strikeAction,
						duration: duration !== undefined ? Number(duration) : null,
					},
					update: {
						action: strikeAction,
						duration: duration !== undefined ? Number(duration) : undefined,
					},
				});
				return res.json({ ok: true, strikeConfig: result });
			} else if (action === "remove") {
				if (strikes === undefined) {
					return res.status(400).json({ ok: false, error: "missing strikes threshold" });
				}
				await db.prisma.automodStrikeConfig.delete({
					where: { configId_strikes: { configId: guildId, strikes: Number(strikes) } },
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
