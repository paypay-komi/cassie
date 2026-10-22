const { getUserGuilds } = require("../../../lib/guildListCache");

const MANAGE_GUILD = 0x20;
const BOT_PERMS = 387136; // Send Messages, Read Message History, Embed Links, Attach Files, Use External Emojis, Add Reactions, Manage Messages

const BOT_GUILD_TTL = 15 * 1000;
let botGuildCache = { at: 0, ids: new Set(), counts: new Map() };

async function getBotGuilds(client) {
	if (!client) return botGuildCache;
	if (Date.now() - botGuildCache.at < BOT_GUILD_TTL) return botGuildCache;

	const snapshot = { at: Date.now(), ids: new Set(), counts: new Map() };
	if (client.shard) {
		const shardGuilds = await client.shard.broadcastEval((c) =>
			[...c.guilds.cache.values()].map((g) => [g.id, g.memberCount ?? 0]),
		);
		for (const arr of shardGuilds) {
			for (const [id, count] of arr) {
				snapshot.ids.add(id);
				snapshot.counts.set(id, count);
			}
		}
	} else {
		for (const g of client.guilds.cache.values()) {
			snapshot.ids.add(g.id);
			snapshot.counts.set(g.id, g.memberCount ?? 0);
		}
	}
	botGuildCache = snapshot;
	return snapshot;
}

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
			const client = req.app?.locals?.client;
			const [discordGuilds, botGuilds] = await Promise.all([
				getUserGuilds(session),
				getBotGuilds(client).catch((e) => {
					console.error("Failed to get bot guilds:", e);
					return botGuildCache;
				}),
			]);

			const manageable = discordGuilds.filter(
				(g) => (Number(g.permissions) & MANAGE_GUILD) === MANAGE_GUILD || g.owner,
			);

			res.set("Cache-Control", "private, max-age=30");
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
					botIn: botGuilds.ids.has(g.id),
					memberCount: botGuilds.ids.has(g.id)
						? botGuilds.counts.get(g.id) ?? null
						: null,
				})),
			});
		} catch (err) {
			console.error(err);
			return res.status(err.status === 401 ? 401 : 500).json({
				ok: false,
				error:
					err.status === 401 ? "unauthorized" : "failed_to_fetch_guilds",
			});
		}
	},
};
