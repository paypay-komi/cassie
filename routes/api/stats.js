module.exports = {
	path: "/api/stats",
	method: "get",

	handler: async (req, res) => {
		try {
			const client = req.app?.locals?.client;
			if (!client) {
				return res.json({ ok: false, error: "client not available" });
			}

			const guildCount = client.guilds?.cache?.size ?? 0;
			let cmdCount = 0;
			try {
				cmdCount = await client.db.prisma.userCommandStats.count();
			} catch {}

			res.json({
				ok: true,
				guilds: guildCount,
				commands: cmdCount,
			});
		} catch (err) {
			console.error(err);
			res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
