const { PermissionsBitField } = require("discord.js");
const db = require("../../../db");
const { buildMessageBlocks } = require("../../../lib/v2Reply");

module.exports = {

commandId: "b4c5d6e7-f8a9-0123-7890-456789012345",
	name: "stats",
	description: "Show your counting stats",
	aliases: ["me", "score"],
	parent: "counting",

	async execute(message) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config || !config.enabled) return message.reply(buildMessageBlocks(["Counting isn't set up."], 0xED4245));

		const score = await db.prisma.countingScore.findUnique({
			where: { guildId_userId: { guildId: message.guild.id, userId: message.author.id } },
		});

		if (!score) return message.reply(buildMessageBlocks(["You haven't counted yet!"], 0x5865F2));

		const blocks = [
			`## Your Counting Stats`,
			`**Score:** ${score.score}  •  **Correct:** ${score.correct}  •  **Wrong:** ${score.wrong}`,
			score.lastCountAt ? `Last count: <t:${Math.floor(score.lastCountAt.getTime() / 1000)}:R>` : "",
		].filter(Boolean);

		message.reply(buildMessageBlocks(blocks, 0x5865F2));
	},
};