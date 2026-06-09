const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cachedUrl = null;
let cacheTime = 0;

module.exports = {
	path: "/api/invite/support",
	method: "get",

	handler: async (req, res) => {
		// Return cached invite if still fresh
		if (cachedUrl && Date.now() - cacheTime < CACHE_TTL) {
			return res.json({ ok: true, url: cachedUrl, cached: true });
		}

		try {
			const client = req.app?.locals?.client;
			if (!client) {
				return res.json({ ok: false, error: "client not available" });
			}

			const guildId = process.env.SUPPORT_GUILD_ID;
			if (!guildId) {
				return res.json({ ok: false, error: "no support guild configured" });
			}

			// Try to get guild from current shard (shard 0)
			let guild = client.guilds.cache.get(guildId);

			// If not on this shard, use broadcastEval
			if (!guild && client.shard) {
				const results = await client.shard.broadcastEval(
					(c, { id }) => {
						const g = c.guilds.cache.get(id);
						if (!g) return null;

						// Find best channel: system channel, or first text channel
						const channel =
							g.systemChannel ||
							g.channels.cache.find(
								(ch) =>
									ch.type === 0 &&
									ch.permissionsFor(g.members.me).has("CreateInstantInvite"),
							);

						if (!channel) return { error: "no suitable channel" };

						return channel
							.createInvite({
								maxAge: 0,
								maxUses: 0,
								temporary: false,
								reason: "Support server invite for dashboard",
							})
							.then((invite) => ({ url: `https://discord.gg/${invite.code}` }))
							.catch(() => ({ error: "failed to create invite" }));
					},
					{ context: { id: guildId } },
				);

				const found = results.find((r) => r !== null && r.url);
				if (found) {
					cachedUrl = found.url;
					cacheTime = Date.now();
					return res.json({ ok: true, url: found.url });
				}
				return res.json({
					ok: false,
					error: "could not create invite",
					detail: results.find((r) => r !== null)?.error || "guild not found",
				});
			}

			if (!guild) {
				return res.json({ ok: false, error: "guild not found" });
			}

			// Find best channel
			const channel =
				guild.systemChannel ||
				guild.channels.cache.find(
					(ch) =>
						ch.type === 0 &&
						ch.permissionsFor(guild.members.me).has("CreateInstantInvite"),
				);

			if (!channel) {
				return res.json({ ok: false, error: "no suitable channel found" });
			}

			const invite = await channel.createInvite({
				maxAge: 0,
				maxUses: 0,
				temporary: false,
				reason: "Support server invite for dashboard",
			});

			cachedUrl = `https://discord.gg/${invite.code}`;
			cacheTime = Date.now();
			return res.json({ ok: true, url: cachedUrl });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
