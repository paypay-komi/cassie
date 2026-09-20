const { Events } = require("discord.js");
const { getLogger } = require("../lib/logger");

const log = getLogger("InviteTracker");

module.exports = {
	name: Events.GuildMemberRemove,
	async execute(client, member) {
		if (!member?.guild || member.user.bot) return;

		const prisma = client.db.prisma;
		const guild = member.guild;

		let join = null;
		try {
			join = await prisma.inviteJoin.findFirst({
				where: { guildId: guild.id, userId: member.id, leftAt: null },
				orderBy: { joinedAt: "desc" },
			});
		} catch (err) {
			log.warn(`Failed to find join for ${member.id}: ${err.message}`);
			return;
		}

		if (!join) return;

		try {
			await prisma.inviteJoin.update({
				where: { id: join.id },
				data: { leftAt: new Date() },
			});
		} catch (err) {
			log.warn(`Failed to mark leave for ${member.id}: ${err.message}`);
			return;
		}

		if (!join.inviteId) return;

		let config = null;
		try {
			config = await prisma.guildInviteConfig.findUnique({
				where: { guildId: guild.id },
			});
		} catch {
			/* ignore */
		}

		if (config && config.deductOnLeave) {
			await prisma.invite
				.updateMany({
					where: { id: join.inviteId, uses: { gt: 0 } },
					data: { uses: { decrement: 1 } },
				})
				.catch(() => {});
		}
	},
};
