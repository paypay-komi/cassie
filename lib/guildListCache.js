const fetch = require("node-fetch");

const GUILD_TTL = 60 * 1000;
const GUILD_MAX_STALE = 10 * 60 * 1000;

const cache = new Map(); // userId -> { at, guilds, refreshing }
const inflight = new Map(); // userId -> Promise<guilds>

async function fetchFromDiscord(session, attempt = 0) {
	const res = await fetch("https://discord.com/api/users/@me/guilds", {
		headers: { Authorization: `Bearer ${session.accessToken}` },
	});

	if (res.status === 429 && attempt < 1) {
		let waitMs = Number(res.headers.get("retry-after")) * 1000;
		if (!Number.isFinite(waitMs) || waitMs <= 0) {
			try {
				const body = await res.json();
				waitMs = Number(body.retry_after) * 1000;
			} catch {}
		}
		waitMs = Math.min(Math.max(waitMs || 600, 250), 2500);
		await new Promise((resolve) => setTimeout(resolve, waitMs));
		return fetchFromDiscord(session, attempt + 1);
	}

	if (!res.ok) {
		const err = new Error(
			res.status === 401 ? "session_expired" : "discord_guilds_" + res.status,
		);
		err.status = res.status === 401 ? 401 : 502;
		throw err;
	}

	return res.json();
}

function refresh(session, userId) {
	if (inflight.has(userId)) return inflight.get(userId);

	const promise = fetchFromDiscord(session)
		.then((guilds) => {
			cache.set(userId, { at: Date.now(), guilds, refreshing: null });
			return guilds;
		})
		.finally(() => inflight.delete(userId));

	inflight.set(userId, promise);
	return promise;
}

function prune() {
	if (cache.size <= 500) return;
	const now = Date.now();
	for (const [userId, entry] of cache) {
		if (!entry.refreshing && now - entry.at > GUILD_MAX_STALE) {
			cache.delete(userId);
		}
	}
}

/**
 * Returns the user's Discord guild list from a short-lived in-memory cache.
 * After the fresh window, the last good list is served immediately while a
 * background refresh runs, so a slow Discord API never blocks navigation.
 */
async function getUserGuilds(session) {
	const userId = session.user.id;
	const entry = cache.get(userId);
	const now = Date.now();

	if (entry && now - entry.at < GUILD_TTL) return entry.guilds;

	if (entry && now - entry.at < GUILD_MAX_STALE) {
		if (!entry.refreshing) {
			entry.refreshing = refresh(session, userId).catch((err) => {
				entry.refreshing = null;
				console.error("Guild list refresh failed:", err.message);
			});
		}
		return entry.guilds;
	}

	const guilds = await refresh(session, userId);
	prune();
	return guilds;
}

module.exports = { getUserGuilds };
