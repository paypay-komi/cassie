module.exports = {
	path: "/api/data/guild-users-bulk",
	method: "post",

	handler: async (req, res) => {
		const session = req.session;
		const { guildId, userIds } = req.body;

		if (!session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}
		if (!guildId || !Array.isArray(userIds) || !userIds.length) {
			return res.status(400).json({ ok: false, error: "missing guildId or userIds" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const client = req.app.locals.client;
			const guild = req.app.locals.guild || client.guilds.cache.get(guildId);
			if (!guild) {
				return res.status(404).json({ ok: false, error: "guild_not_found" });
			}

			const users = {};
			for (const userId of userIds.slice(0, 50)) {
				const user = await client.users.fetch(userId).catch(() => null);
				if (!user) continue;

				let member = guild.members.cache.get(userId);
			if (!member) {
				member = await guild.members.fetch(userId).catch(() => null);
			}
				
				const avatarDecoration = user.avatarDecoration ? {
					asset: user.avatarDecoration.asset,
					skuId: user.avatarDecoration.skuId,
					animated: user.avatarDecoration.asset?.startsWith('a_') || false,
				} : null;

				users[userId] = {
					id: user.id,
					username: user.username,
					globalName: user.globalName,
					discriminator: user.discriminator,
					avatar: user.avatar,
					banner: user.banner,
					bannerColor: user.hexAccentColor || (user.accentColor ? `#${user.accentColor.toString(16).padStart(6, '0')}` : null),
					avatarDecoration,
					accentColor: user.accentColor,
					flags: user.flags?.toArray() || [],
					bot: user.bot,
					system: user.system,
					createdAt: user.createdAt.toISOString(),
					member: member ? {
						joinedAt: member.joinedAt?.toISOString(),
						roles: member.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position })).sort((a,b) => b.position - a.position),
						nickname: member.nickname,
						premiumSince: member.premiumSince?.toISOString(),
					} : null,
				};
			}

			return res.json({ ok: true, users });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};

const { requireGuildAccess } = require("../../../lib/guildGuard");