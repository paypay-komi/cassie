const { getLogger } = require("../../../lib/logger");
const log = getLogger("guild-user-info");

module.exports = {
	path: "/api/data/guild-user-info",
	method: "get",

	handler: async (req, res) => {
		const session = req.session;
		const { userId } = req.query;

		if (!session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}
		if (!userId) {
			return res.status(400).json({ ok: false, error: "missing userId" });
		}

		try {
			const client = req.app.locals.client;
			const guildId = req.query.guildId || req.body?.guildId;
			const guild = guildId ? client.guilds.cache.get(guildId) : null;
			
			let user = await client.users.fetch(userId).catch(() => null);
			if (!user) {
				return res.status(404).json({ ok: false, error: "user_not_found" });
			}

			// Force fresh fetch for banner
			user = await client.users.fetch(userId, { force: true }).catch(() => user);

			let member = null;
			if (guild) {
				member = guild.members.cache.get(userId);
				if (!member) {
					member = await guild.members.fetch(userId).catch(() => null);
				}
			} else if (guildId) {
				// Guild not in cache (different shard) - fetch via REST
				try {
					const restMember = await client.rest.get(`/guilds/${guildId}/members/${userId}`);
					member = { ...restMember, roles: restMember.roles || [] };
				} catch {}
			}

			// Avatar decoration (Nitro) - detect animated
			const avatarDecoration = user.avatarDecoration ? {
				asset: user.avatarDecoration.asset,
				skuId: user.avatarDecoration.skuId,
				animated: user.avatarDecoration.asset?.startsWith('a_') || false,
			} : null;

			// Banner color
			const bannerColor = user.hexAccentColor || (user.accentColor ? `#${user.accentColor.toString(16).padStart(6, '0')}` : null);

			log.debug('Fetched user', { id: user.id, banner: user.banner, hasMember: !!member });

			// Normalize member from REST API (roles array vs cache)
			let memberData = null;
			if (member) {
				const roles = member.roles?.cache 
					? member.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position })).sort((a,b) => b.position - a.position)
					: (member.roles || []).map(r => typeof r === 'string' ? { id: r, name: r, color: 0, position: 0 } : r).sort((a,b) => (b.position||0) - (a.position||0));
				
				memberData = {
					joinedAt: member.joined_at || member.joinedAt,
					roles,
					nickname: member.nick || member.nickname,
					premiumSince: member.premium_since || member.premiumSince,
				};
			}

			return res.json({
				ok: true,
				user: {
					id: user.id,
					username: user.username,
					globalName: user.globalName,
					discriminator: user.discriminator,
					avatar: user.avatar,
					banner: user.banner,
					bannerColor,
					avatarDecoration,
					accentColor: user.accentColor,
					flags: user.flags?.toArray() || [],
					bot: user.bot,
					system: user.system,
					createdAt: user.createdAt.toISOString(),
					member: memberData,
				},
			});
		} catch (err) {
			log.error('Error fetching user', err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};