const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "c6113969-a0ea-4222-8508-af0812f82c69",
	name: "leaderboard",
	parent: "invites",
	description: "Show the top inviters",
	dmUse: false,

	async execute(message) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;

		const invites = await prisma.invite.findMany({
			where: { guildId },
			select: { id: true, inviterId: true },
		});
		const byId = new Map(invites.map((i) => [i.id, i.inviterId]));

		const joins = await prisma.inviteJoin.findMany({
			where: {
				guildId,
				fake: false,
				leftAt: null,
				inviteId: { not: null },
			},
			select: { inviteId: true },
		});

		const counts = new Map();
		for (const j of joins) {
			const inviter = byId.get(j.inviteId);
			if (inviter) counts.set(inviter, (counts.get(inviter) || 0) + 1);
		}

		const top = [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);

		if (!top.length) return message.reply(buildMessage("No invites tracked yet."));

		const lines = ["## 🏆 Invite Leaderboard"];
		let rank = 1;
		for (const [userId, count] of top) {
			const user = await message.client.users
				.fetch(userId)
				.catch(() => null);
			lines.push(`**${rank}.** ${user ? user.username : userId} — ${count}`);
			rank++;
		}

		return message.reply(buildMessage(lines.join("\n"), 0xfee75c));
	},
};
