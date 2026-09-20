const { Events } = require("discord.js");
const { getLogger } = require("../lib/logger");

const log = getLogger("InviteTracker");

module.exports = {
	name: Events.InviteCreate,
	async execute(client, invite) {
		if (!invite.guild) return;

		const cache = client.inviteCache || (client.inviteCache = new Map());
		let map = cache.get(invite.guild.id);
		if (!map) {
			map = new Map();
			cache.set(invite.guild.id, map);
		}

		map.set(invite.code, {
			uses: invite.uses ?? 0,
			inviterId: invite.inviter?.id ?? null,
		});

		try {
			await client.db.prisma.invite.upsert({
				where: {
					guildId_code: {
						guildId: invite.guild.id,
						code: invite.code,
					},
				},
				update: {
					uses: invite.uses ?? 0,
					maxUses: invite.maxUses ?? 0,
					temporary: invite.temporary ?? false,
					expiresAt: invite.expiresAt ?? null,
				},
				create: {
					guildId: invite.guild.id,
					code: invite.code,
					inviterId: invite.inviter?.id ?? "unknown",
					uses: invite.uses ?? 0,
					maxUses: invite.maxUses ?? 0,
					temporary: invite.temporary ?? false,
					expiresAt: invite.expiresAt ?? null,
				},
			});
		} catch (err) {
			log.warn(`Failed to persist invite ${invite.code}: ${err.message}`);
		}
	},
};
