const { buildMessage } = require("../../../lib/v2Reply");
const levels = require("../../../lib/levels");

module.exports = {

commandId: "2fe844f7-d0ef-484a-a272-9174060b1894",
	name: "rank",
	parent: "levels",
	description: "Show your level and rank",
	dmUse: false,

	async execute(message) {
		const prisma = message.client.db.prisma;
		const target = message.mentions.users.first() || message.author;

		const m = await levels.getMember(prisma, message.guild.id, target.id);
		const prog = levels.levelFromXp(m.xp);
		const higher = await prisma.memberXP.count({
			where: { guildId: message.guild.id, xp: { gt: m.xp } },
		});
		const bar = levels.progressBar(prog.current, prog.needed);

		const lines = [
			`## 🏅 ${target.username}`,
			`**Level:** ${prog.level}`,
			`**XP:** ${prog.current} / ${prog.needed}`,
			bar,
			`**Rank:** #${higher + 1}`,
			`**Total XP:** ${m.xp.toString()}`,
			`**Voice time:** ${Math.floor(
				Number(m.totalVoiceSec) / 3600,
			)}h`,
		];

		return message.reply(buildMessage(lines.join("\n"), 0x5865f2));
	},
};
