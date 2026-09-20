const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "eac662d2-ffe9-4ecf-84e3-2cfd147a961b",
	name: "history",
	parent: "mod",
	description: "Show the moderation history of a user",
	usage: "mod history <@user>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const target = message.mentions.users.first();
		if (!target) return message.reply(buildMessage("Mention a user to view history."));

		const cases = await prisma.moderationCase.findMany({
			where: { guildId: message.guild.id, targetId: target.id },
			orderBy: { caseNumber: "desc" },
			take: 25,
		});

		if (!cases.length) return message.reply(buildMessage(`No moderation history for <@${target.id}>.`));

		const active = await moderation.warnCount(prisma, message.guild.id, target.id);

		const lines = [
			`## 🗂️ Moderation history — ${target.tag}`,
			`**Warnings:** ${active}`,
			"",
			...cases.map(
				(c) =>
					`\`#${c.caseNumber}\` **${c.type}** — ${c.reason} (<@${c.moderatorId}> · <t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:R>)`,
			),
		];

		return message.reply(buildMessage(lines.join("\n"), 0x5865f2));
	},
};