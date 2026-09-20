const { getLogger } = require("./logger");

const log = getLogger("InviteTracker");

/**
 * In-memory invite cache shape:
 *   client.inviteCache: Map<guildId, Map<code, {uses, inviterId, maxUses, temporary, expiresAt}>>
 */
function getCache(client) {
	if (!client.inviteCache) client.inviteCache = new Map();
	return client.inviteCache;
}

function getGuildCache(client, guildId) {
	return getCache(client).get(guildId) || new Map();
}

function setGuildCache(client, guildId, map) {
	getCache(client).set(guildId, map);
}

/**
 * Fetch every invite for a guild and replace its cached snapshot.
 * @returns {Map<string, object>|null} new cache, or null if fetch failed
 */
async function refresh(client, guild) {
	const invites = await guild.invites.fetch().catch(() => null);
	if (!invites) return null;

	const map = new Map();
	for (const inv of invites.values()) {
		map.set(inv.code, {
			uses: inv.uses ?? 0,
			inviterId: inv.inviter?.id ?? null,
			maxUses: inv.maxUses ?? 0,
			temporary: inv.temporary ?? false,
			expiresAt: inv.expiresAt ?? null,
		});
	}

	setGuildCache(client, guild.id, map);
	return map;
}

/**
 * Diff the cached snapshot against live invites to find which invite was used
 * for a join. Refreshes the cache as a side effect.
 *
 * @returns {{inviterId: string|null, code: string|null, unknown: boolean, vanity: boolean}}
 */
async function detect(client, guild) {
	const before = getGuildCache(client, guild.id);
	const invites = await guild.invites.fetch().catch(() => null);

	if (!invites) {
		return { inviterId: null, code: null, unknown: true, vanity: false };
	}

	let usedCode = null;
	let bestDiff = 0;

	for (const inv of invites.values()) {
		const uses = inv.uses ?? 0;
		const prev = before.get(inv.code);
		const prevUses = prev ? prev.uses : 0;
		const diff = uses - prevUses;
		if (diff > bestDiff) {
			bestDiff = diff;
			usedCode = inv.code;
		}
	}

	// Rebuild the snapshot from live data
	const map = new Map();
	for (const inv of invites.values()) {
		map.set(inv.code, {
			uses: inv.uses ?? 0,
			inviterId: inv.inviter?.id ?? null,
			maxUses: inv.maxUses ?? 0,
			temporary: inv.temporary ?? false,
			expiresAt: inv.expiresAt ?? null,
		});
	}
	setGuildCache(client, guild.id, map);

	if (!usedCode && guild.vanityURLCode) {
		return {
			inviterId: null,
			code: guild.vanityURLCode,
			unknown: true,
			vanity: true,
		};
	}

	if (!usedCode) {
		return { inviterId: null, code: null, unknown: true, vanity: false };
	}

	const entry = map.get(usedCode);
	return {
		inviterId: entry?.inviterId ?? null,
		code: usedCode,
		unknown: false,
		vanity: false,
	};
}

/**
 * Sum the bonus invites granted to a member by InviteBonus role rules.
 */
async function bonusFor(prisma, guildId, member) {
	try {
		const rows = await prisma.inviteBonus.findMany({ where: { guildId } });
		if (!rows.length || !member) return 0;
		let bonus = 0;
		for (const row of rows) {
			if (member.roles?.cache?.has(row.roleId)) bonus += row.bonus;
		}
		return bonus;
	} catch (err) {
		log.warn(`bonusFor failed: ${err.message}`);
		return 0;
	}
}

/**
 * Compute invite stats for a member.
 * @returns {{regular:number, leaves:number, fake:number, bonus:number, total:number, codes:string[], joins:Array}}
 */
async function getStats(prisma, guildId, userId, member = null) {
	const invites = await prisma.invite.findMany({
		where: { guildId, inviterId: userId },
		select: { id: true, code: true },
	});

	const ids = invites.map((i) => i.id);
	let joins = [];
	if (ids.length) {
		joins = await prisma.inviteJoin.findMany({
			where: { guildId, inviteId: { in: ids } },
			orderBy: { joinedAt: "desc" },
		});
	}

	const regular = joins.filter((j) => !j.fake && !j.leftAt).length;
	const leaves = joins.filter((j) => j.leftAt).length;
	const fake = joins.filter((j) => j.fake).length;
	const bonus = member ? await bonusFor(prisma, guildId, member) : 0;

	let adjust = 0;
	try {
		const row = await prisma.inviteAdjustment.findUnique({
			where: { guildId_userId: { guildId, userId } },
		});
		adjust = row?.amount ?? 0;
	} catch {
		/* ignore */
	}

	return {
		regular,
		leaves,
		fake,
		bonus,
		adjust,
		total: regular + bonus + adjust,
		codes: invites.map((i) => i.code),
		joins,
	};
}

/**
 * Render an invite announcement template.
 * Supported tokens: {user}, {user.tag}, {inviter}, {invites}, {guild}, {code}
 */
function renderMessage(template, vars) {
	return template
		.replaceAll("{user.tag}", vars.userTag ?? vars.user ?? "")
		.replaceAll("{user}", vars.user ?? "")
		.replaceAll("{inviter}", vars.inviter ?? "Unknown")
		.replaceAll("{invites}", String(vars.invites ?? 0))
		.replaceAll("{guild}", vars.guild ?? "")
		.replaceAll("{code}", vars.code ?? "unknown");
}

module.exports = {
	refresh,
	detect,
	getCache,
	getGuildCache,
	setGuildCache,
	bonusFor,
	getStats,
	renderMessage,
};
