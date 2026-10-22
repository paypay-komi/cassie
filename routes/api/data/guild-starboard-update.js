const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-starboard-update",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, emoji, config, action, newEmoji } = req.body || {};
		if (!guildId || !emoji) {
			return res.status(400).json({ ok: false, error: "missing guildId or emoji" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			if (action === "delete") {
				await db.prisma.starboard.deleteMany({ where: { guildId, emoji } });
				return res.json({ ok: true });
			}

			if (action === "rename") {
				if (!newEmoji) {
					return res.status(400).json({ ok: false, error: "missing newEmoji" });
				}
				const existing = await db.prisma.starboard.findUnique({
					where: { guildId_emoji: { guildId, emoji } },
				});
				if (!existing) {
					return res.status(404).json({ ok: false, error: "starboard not found" });
				}
				const result = await db.prisma.starboard.update({
					where: { guildId_emoji: { guildId, emoji } },
					data: { emoji: newEmoji },
				});
				return res.json({ ok: true, starboard: result });
			}

			if (!config || typeof config !== "object") {
				return res.status(400).json({ ok: false, error: "missing config" });
			}
			if (!config.channelId) {
				return res.status(400).json({ ok: false, error: "missing channelId" });
			}

			let color = null;
			if (config.color !== undefined && config.color !== null && config.color !== "") {
				const n = Number(config.color);
				color = Number.isFinite(n) ? n : null;
			}

			const data = {
				channelId: config.channelId,
				emoji,
				threshold: config.threshold !== undefined ? Number(config.threshold) : 1,
				selfStar: config.selfStar !== undefined ? !!config.selfStar : false,
				showAttachments: config.showAttachments !== undefined ? !!config.showAttachments : true,
				showTimestamp: config.showTimestamp !== undefined ? !!config.showTimestamp : true,
				jumpUrl: config.jumpUrl !== undefined ? !!config.jumpUrl : true,
				color,
			};

			const result = await db.prisma.starboard.upsert({
				where: { guildId_emoji: { guildId, emoji } },
				create: { guildId, ...data },
				update: data,
			});

			return res.json({ ok: true, starboard: result });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
