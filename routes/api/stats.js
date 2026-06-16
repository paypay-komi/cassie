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
			const memberCount = client.guilds?.cache?.reduce(
				(sum, g) => sum + (g.memberCount ?? 0), 0
			) ?? 0;
			let cmdCount = 0;
			let userCount = 0;
			try {
				cmdCount = await client.db.stats.getTotalExecutions();
			} catch {}
			try {
				userCount = await client.db.stats.getTotalUsers();
			} catch {}

			res.json({
				ok: true,
				guilds: guildCount,
				members: memberCount,
				commands: cmdCount,
				users: userCount,
			});
		} catch (err) {
			console.error(err);
			res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
