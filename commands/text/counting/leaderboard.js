const { PermissionsBitField } = require("discord.js");
const db = require("../../../db");
const { buildMessageBlocks } = require("../../../lib/v2Reply");

module.exports = {

commandId: "a3b4c5d6-e7f8-9012-6789-345678901234",
	name: "leaderboard",
	description: "Show the counting leaderboard",
	aliases: ["lb", "top"],
	parent: "counting",

	async execute(message) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config || !config.enabled) return message.reply(buildMessageBlocks(["Counting isn't set up."], 0xED4245));

		const scores = await db.prisma.countingScore.findMany({
			where: { guildId: message.guild.id },
			orderBy: { score: "desc" },
			take: 10,
		});

		if (scores.length === 0) return message.reply(buildMessageBlocks(["No scores yet. Start counting!"], 0x5865F2));

		const blocks = [`## Counting Leaderboard`];
		for (let i = 0; i < scores.length; i++) {
			const s = scores[i];
			blocks.push(`${i + 1}. <@${s.userId}> — **${s.score}** (${s.correct} ✓ / ${s.wrong} ✗)`);
		}

		message.reply(buildMessageBlocks(blocks, 0x5865F2));
	},
};