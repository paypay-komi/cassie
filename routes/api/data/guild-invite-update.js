const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-invite-update",
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
			if (config.channelId !== undefined) data.channelId = config.channelId;
			if (config.message !== undefined) data.message = config.message;
			if (config.deductOnLeave !== undefined) data.deductOnLeave = !!config.deductOnLeave;
			if (config.fakeAccountDays !== undefined) data.fakeAccountDays = Number(config.fakeAccountDays);
			if (config.trackingEnabled !== undefined) data.trackingEnabled = !!config.trackingEnabled;

			const result = await db.prisma.guildInviteConfig.upsert({
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
