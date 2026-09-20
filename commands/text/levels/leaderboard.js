const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "182386fe-39d8-46cb-bdd0-3c8093c25f8b",
	name: "leaderboard",
	parent: "levels",
	description: "Show the XP leaderboard",
	dmUse: false,

	async execute(message) {
		const prisma = message.client.db.prisma;
		const rows = await prisma.memberXP.findMany({
			where: { guildId: message.guild.id, xp: { gt: 0 } },
			orderBy: { xp: "desc" },
			take: 10,
		});

		if (!rows.length) return message.reply(buildMessage("No XP tracked yet."));

		const lines = ["## 🏆 XP Leaderboard"];
		let rank = 1;
		for (const r of rows) {
			const user = await message.client.users
				.fetch(r.userId)
				.catch(() => null);
			lines.push(
				`**${rank}.** ${
					user ? user.username : r.userId
				} — level ${r.level} (${r.xp.toString()} XP)`,
			);
			rank++;
		}

		return message.reply(buildMessage(lines.join("\n"), 0xfee75c));
	},
};
