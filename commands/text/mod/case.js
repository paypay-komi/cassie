const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "3b937345-c351-4477-939d-aff94e977a8d",
	name: "case",
	parent: "mod",
	description: "View details of a moderation case",
	usage: "mod case <caseNumber>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const num = parseInt(args[0], 10);
		if (!num) return message.reply(buildMessage("Provide a case number."));

		const modCase = await prisma.moderationCase.findUnique({
			where: { guildId_caseNumber: { guildId: message.guild.id, caseNumber: num } },
		});
		if (!modCase) return message.reply(buildMessage(`No case #${num} found.`));

		const target = await message.guild.members.fetch(modCase.targetId).catch(() => null);
		const moderator = await message.guild.members.fetch(modCase.moderatorId).catch(() => null);

		const lines = [
			`## 🗄️ Case #${modCase.caseNumber}`,
			`**Type:** \`${modCase.type}\``,
			`**User:** ${target ? `<@${target.id}>` : `<@${modCase.targetId}>`}`,
			`**Moderator:** ${moderator ? `<@${moderator.id}>` : `<@${modCase.moderatorId}>`}`,
			`**Reason:** ${modCase.reason}`,
			`**Duration:** ${moderation.formatDuration(modCase.duration)}`,
			`**Date:** <t:${Math.floor(new Date(modCase.createdAt).getTime() / 1000)}:f>`,
		];

		return message.reply(buildMessage(lines.join("\n"), modCase.type === "warn" ? 0xfee75c : 0x5865f2));
	},
};