const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-member-search",
	method: "get",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const guildId = req.query.guildId;
		const query = (req.query.q || "").trim();

		if (!guildId) {
			return res.status(400).json({ ok: false, error: "missing guildId" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		if (query.length < 2) {
			return res.json({ ok: true, members: [] });
		}

		try {
			const client = req.app?.locals?.client;
			if (!client) {
				return res.status(500).json({ ok: false, error: "client not available" });
			}

			let guild = client.guilds.cache.get(guildId);

			const fetchMembers = async (g) => {
				try {
					const fetched = await g.members.fetch({ query, limit: 15 });
					return fetched.map((m) => ({
						id: m.id,
						username: m.user.username,
						displayName: m.displayName,
					}));
				} catch {
					// Fall back to cache if search fails
					return g.members.cache
						.filter(
							(m) =>
								m.user.username.toLowerCase().includes(query) ||
								(m.displayName && m.displayName.toLowerCase().includes(query)),
						)
						.map((m) => ({
							id: m.id,
							username: m.user.username,
							displayName: m.displayName,
						}));
				}
			};

			if (!guild && client.shard) {
				const results = await client.shard.broadcastEval(
					(c, { id, q }) => {
						const g = c.guilds.cache.get(id);
						if (!g) return null;
						return g.members
							.fetch({ query: q, limit: 15 })
							.then((fetched) =>
								fetched.map((m) => ({
									id: m.id,
									username: m.user.username,
									displayName: m.displayName,
								})),
							)
							.catch(() => {
								// Fall back to cache
								return g.members.cache
									.filter(
										(m) =>
											m.user.username.toLowerCase().includes(q) ||
											(m.displayName && m.displayName.toLowerCase().includes(q)),
									)
									.map((m) => ({
										id: m.id,
										username: m.user.username,
										displayName: m.displayName,
									}));
							});
					},
					{ context: { id: guildId, q: query } },
				);
				const found = results.find((r) => r !== null);
				if (found) return res.json({ ok: true, members: found });
				return res.json({ ok: true, members: [] });
			}

			if (!guild) {
				return res.json({ ok: true, members: [] });
			}

			const members = await fetchMembers(guild);
			return res.json({ ok: true, members });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
