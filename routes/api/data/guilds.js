const fetch = require("node-fetch");
const db = require("../../../db");

const MANAGE_GUILD = 0x20;
const BOT_PERMS = 387136; // Send Messages, Read Message History, Embed Links, Attach Files, Use External Emojis, Add Reactions, Manage Messages

module.exports = {
	path: "/api/data/guilds",
	method: "get",

	handler: async (req, res) => {
		const session = req.session;

		if (!session?.user || !session?.accessToken) {
			return res.status(401).json({
				ok: false,
				error: "unauthorized",
			});
		}

		try {
			// Fetch user's guilds via Discord API
			const response = await fetch(
				"https://discord.com/api/users/@me/guilds",
				{
					headers: {
						Authorization: `Bearer ${session.accessToken}`,
					},
				},
			);

			if (!response.ok) {
				return res.status(500).json({
					ok: false,
					error: "failed_to_fetch_guilds",
				});
			}

			const discordGuilds = await response.json();

			// Get bot's guild IDs across all shards
			let botGuildIds = new Set();
			try {
				const client = req.app?.locals?.client;
				if (client) {
					if (client.shard) {
						const shardGuilds = await client.shard.broadcastEval(
							(c) => [...c.guilds.cache.keys()],
						);
						for (const ids of shardGuilds) {
							for (const id of ids) botGuildIds.add(id);
						}
					} else {
						for (const id of client.guilds.cache.keys()) {
							botGuildIds.add(id);
						}
					}
				}
			} catch (e) {
				console.error("Failed to get bot guilds:", e);
			}

			// Filter to guilds where user has MANAGE_GUILD
			const manageable = discordGuilds.filter(
				(g) => (Number(g.permissions) & MANAGE_GUILD) === MANAGE_GUILD || g.owner,
			);

			return res.json({
				ok: true,
				clientId: process.env.DISCORD_CLIENT_ID,
				perms: BOT_PERMS,
				guilds: manageable.map((g) => ({
					id: g.id,
					name: g.name,
					icon: g.icon
						? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
						: null,
					fallback: g.name
						.split(" ")
						.map((w) => w[0])
						.join("")
						.slice(0, 2)
						.toUpperCase(),
					owner: g.owner,
					botIn: botGuildIds.has(g.id),
				})),
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({
				ok: false,
				error: "internal_error",
			});
		}
	},
};
