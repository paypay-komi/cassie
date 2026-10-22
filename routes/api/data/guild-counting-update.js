const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-counting-update",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, config } = req.body;
		if (!guildId || !config) {
			return res.status(400).json({ ok: false, error: "missing guildId or config" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const allowed = [
				"enabled",
				"channelId",
				"resetOnFail",
				"deleteWrong",
				"allowDecimals",
				"allowMath",
				"allowText",
				"cooldownMs",
				"currentCount",
				"highScore",
				"ephemeralFail",
				"deleteOnFail",
				"showOnFail",
				"reactOnWrong",
				"reactOnCorrect",
				"failMsgDeleteSeconds",
			];
			const data = {};
			for (const key of allowed) {
				if (config[key] !== undefined) data[key] = config[key];
			}

			const updated = await db.prisma.countingConfig.upsert({
				where: { guildId },
				create: { guildId, ...data, currentCount: data.currentCount ? BigInt(data.currentCount) : 0n, highScore: data.highScore ? BigInt(data.highScore) : 0n },
				update: {
					...data,
					currentCount: data.currentCount !== undefined ? BigInt(data.currentCount) : undefined,
					highScore: data.highScore !== undefined ? BigInt(data.highScore) : undefined,
				},
			});

			return res.json({ ok: true, config: { ...updated, currentCount: updated.currentCount.toString(), highScore: updated.highScore.toString() } });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
