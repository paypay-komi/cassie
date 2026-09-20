const { Events } = require("discord.js");
const { getLogger } = require("../lib/logger");

const log = getLogger("InviteTracker");

module.exports = {
	name: Events.InviteDelete,
	async execute(client, invite) {
		if (!invite.guild) return;

		const map = client.inviteCache?.get(invite.guild.id);
		if (map) map.delete(invite.code);

		try {
			await client.db.prisma.invite.deleteMany({
				where: { guildId: invite.guild.id, code: invite.code },
			});
		} catch (err) {
			log.warn(`Failed to delete invite ${invite.code}: ${err.message}`);
		}
	},
};
