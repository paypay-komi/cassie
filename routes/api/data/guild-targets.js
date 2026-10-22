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

			const botUser = client.user ? { id: client.user.id, username: client.user.username, avatar: client.user.displayAvatarURL() } : null;

			let guild = client.guilds.cache.get(guildId);

			const channelTypes = [0, 2, 4, 5];
			const buildChannels = (g) =>
				g.channels.cache
					.filter((ch) => channelTypes.includes(ch.type))
					.map((ch) => ({ id: ch.id, name: ch.name, type: ch.type }));

			const buildRoles = (g) =>
				g.roles.cache
					.filter((r) => r.id !== guildId)
					.sort((a, b) => b.position - a.position)
					.map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));

			const buildEmojis = (g) =>
				g.emojis.cache.map((e) => ({ id: e.id, name: e.name, animated: e.animated }));

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
						const chTypes = [0, 2, 4, 5];
						const chFiltered = g.channels.cache
							.filter((ch) => chTypes.includes(ch.type))
							.map((ch) => ({ id: ch.id, name: ch.name, type: ch.type }));
						const rFiltered = g.roles.cache
							.filter((r) => r.id !== guildId)
							.sort((a, b) => b.position - a.position)
							.map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));
						const mFiltered = g.members.cache.map((m) => ({
							id: m.id,
							username: m.user.username,
							displayName: m.displayName,
						}));
						const eFiltered = g.emojis.cache.map((e) => ({ id: e.id, name: e.name, animated: e.animated }));
						return { channels: chFiltered, roles: rFiltered, members: mFiltered, emojis: eFiltered };
					},
					{ context: { id: guildId, guildId } },
				);
				const found = results.find((r) => r !== null);
				if (found) return res.json({ ok: true, botUser, ...found });
				return res.json({ ok: true, botUser, channels: [], roles: [], members: [], emojis: [] });
			}

			if (!guild) {
				return res.json({ ok: true, botUser, channels: [], roles: [], members: [], emojis: [] });
			}

			return res.json({
				ok: true,
				botUser,
				channels: buildChannels(guild),
				roles: buildRoles(guild),
				members: buildMembers(guild),
				emojis: buildEmojis(guild),
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
