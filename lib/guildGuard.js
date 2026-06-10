const fetch = require("node-fetch");

const MANAGE_GUILD = 0x20;

// In-memory permission cache keyed by `${userId}:${guildId}`
const permsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE = 1000;

function cached(userId, guildId) {
	const key = `${userId}:${guildId}`;
	const entry = permsCache.get(key);
	if (entry && Date.now() - entry.time < CACHE_TTL) {
		return entry.guild;
	}
	return null;
}

function setCached(userId, guildId, guild) {
	const key = `${userId}:${guildId}`;
	permsCache.set(key, { guild, time: Date.now() });
	// Evict oldest when over limit
	if (permsCache.size > MAX_CACHE) {
		const oldest = permsCache.keys().next().value;
		permsCache.delete(oldest);
	}
}

/**
 * Verifies that (a) the guild exists, (b) the user has Manage Server
 * permission (or is owner), and (c) the bot is in the guild.
 *
 * Calls the Discord API with the user's OAuth access token — same approach
 * as the guilds list endpoint.
 *
 * @param {object} session - Express session (must have .user and .accessToken)
 * @param {string} guildId - Target Discord guild ID
 * @param {object} [client] - Discord.js client (optional, enables bot-membership check)
 * @returns {{ ok: true, guild: { id, name, icon } } | { ok: false, error: string, status: number }}
 */
async function requireGuildAccess(session, guildId, client) {
	if (!session?.user?.id || !session?.accessToken) {
		return { ok: false, error: "Unauthorized", status: 401 };
	}

	// Check in-memory cache
	const hit = cached(session.user.id, guildId);
	if (hit) return { ok: true, guild: hit };

	// Fetch user's guilds from Discord API
	let discordGuilds;
	try {
		const res = await fetch("https://discord.com/api/users/@me/guilds", {
			headers: {
				Authorization: `Bearer ${session.accessToken}`,
			},
		});

		if (res.status === 401) {
			return { ok: false, error: "Session expired, please re-login", status: 401 };
		}
		if (!res.ok) {
			return { ok: false, error: "Failed to fetch guilds from Discord", status: 502 };
		}

		discordGuilds = await res.json();
	} catch (err) {
		return { ok: false, error: "Discord API unreachable", status: 502 };
	}

	// Find the guild
	const guild = discordGuilds.find((g) => g.id === guildId);
	if (!guild) {
		return { ok: false, error: "Guild not found", status: 404 };
	}

	// Check Manage Server permission
	const isManageable =
		guild.owner || (Number(guild.permissions) & MANAGE_GUILD) === MANAGE_GUILD;
	if (!isManageable) {
		return { ok: false, error: "Forbidden — you need Manage Server permission", status: 403 };
	}

	// Verify bot is in the guild (cross-shard)
	if (client) {
		let botIn = !!client.guilds.cache.get(guildId);
		if (!botIn && client.shard) {
			const results = await client.shard.broadcastEval(
				(c, { id }) => c.guilds.cache.has(id),
				{ context: { id: guildId } },
			);
			botIn = results.some(Boolean);
		}
		if (!botIn) {
			return { ok: false, error: "Bot is not in this guild", status: 404 };
		}
	}

	const guildInfo = {
		id: guild.id,
		name: guild.name,
		icon: guild.icon
			? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
			: null,
	};

	setCached(session.user.id, guildId, guildInfo);
	return { ok: true, guild: guildInfo };
}

module.exports = { requireGuildAccess };
