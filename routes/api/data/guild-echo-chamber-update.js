const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-echo-chamber-update",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, channelId, settings } = req.body;
		if (!guildId || !channelId || !settings) {
			return res.status(400).json({ ok: false, error: "missing guildId, channelId, or settings" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const channel = await db.prisma.echoChannel.findFirst({
				where: { channelId, guildId },
			});

			if (!channel) {
				return res.status(404).json({ ok: false, error: "echo chamber not found" });
			}

			const allowed = ["echoChance", "deleteDelayMin", "deleteDelayMax", "echoDelayMin", "echoDelayMax"];
			const data = {};
			for (const key of allowed) {
				if (settings[key] !== undefined) {
					const val = Number(settings[key]);
					if (isNaN(val) || val < 0) {
						return res.status(400).json({ ok: false, error: `invalid value for ${key}` });
					}
					data[key] = val;
				}
			}

			if (Object.keys(data).length === 0) {
				return res.status(400).json({ ok: false, error: "no valid settings provided" });
			}

			await db.prisma.echoChannel.update({
				where: { id: channel.id },
				data,
			});

			return res.json({ ok: true });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
