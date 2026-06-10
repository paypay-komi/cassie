const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-targets",
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
			const client = req.app?.locals?.client;
			if (!client) {
				return res.status(500).json({ ok: false, error: "client not available" });
			}

			let guild = client.guilds.cache.get(guildId);

			const buildChannels = (g) =>
				g.channels.cache
					.filter((ch) => ch.type === 0 || ch.type === 2 || ch.type === 5)
					.map((ch) => ({ id: ch.id, name: ch.name, type: ch.type }));

			const buildRoles = (g) =>
				g.roles.cache
					.filter((r) => r.id !== guildId)
					.map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));

			const buildMembers = (g) =>
				g.members.cache.map((m) => ({
					id: m.id,
					username: m.user.username,
					displayName: m.displayName,
				}));

			if (!guild && client.shard) {
				const results = await client.shard.broadcastEval(
					(c, { id, guildId }) => {
						const g = c.guilds.cache.get(id);
						if (!g) return null;
						const chFiltered = g.channels.cache
							.filter((ch) => ch.type === 0 || ch.type === 2 || ch.type === 5)
							.map((ch) => ({ id: ch.id, name: ch.name, type: ch.type }));
						const rFiltered = g.roles.cache
							.filter((r) => r.id !== guildId)
							.map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));
						const mFiltered = g.members.cache.map((m) => ({
							id: m.id,
							username: m.user.username,
							displayName: m.displayName,
						}));
						return { channels: chFiltered, roles: rFiltered, members: mFiltered };
					},
					{ context: { id: guildId, guildId } },
				);
				const found = results.find((r) => r !== null);
				if (found) return res.json({ ok: true, ...found });
				return res.json({ ok: true, channels: [], roles: [], members: [] });
			}

			if (!guild) {
				return res.json({ ok: true, channels: [], roles: [], members: [] });
			}

			return res.json({
				ok: true,
				channels: buildChannels(guild),
				roles: buildRoles(guild),
				members: buildMembers(guild),
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
