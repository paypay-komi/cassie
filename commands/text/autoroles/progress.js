const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const db = require("../../../db");

// GLOBAL PAGINATED — uses events/autoroleProgressPagination.js (always running, no timeout, state via button IDs)
const { buildProgressContainer, buildRow, PAGE_SIZE } = require("../../../events/autoroleProgressPagination");

module.exports = {
	commandId: "c9a1d7e2-4b5f-4c8a-9e0f-1a2b3c4d5e6f",
	name: "progress",
	description: "Check your progress toward all auto-role requirements in this server",
	parent: "autorole",
	aliases: ["myprogress", "check", "status", "me"],
	dmUse: false,
	guildUse: true,
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	async execute(message, args, command, client) {
		const guild = message.guild;
		if (!guild) return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ❌ Server only\nThis command only works in a server.`)).setAccentColor(0xed4245)], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });

		// Optional: mention or ID of another user
		let targetId = message.author.id;
		if (args[0]) {
			const mentionMatch = args[0].match(/^<@!?(\d+)>$/);
			if (mentionMatch) {
				targetId = mentionMatch[1];
			} else if (/^\d{17,20}$/.test(args[0])) {
				targetId = args[0];
			}
		}

		const member = await guild.members.fetch(targetId).catch(() => null);
		if (!member) return message.reply({ content: "Couldn't fetch that member.", allowedMentions: { parse: [] } });

		const reqs = await db.prisma.guildMemberRoleRequirement.findMany({ where: { guildId: guild.id }, orderBy: { createdAt: "asc" } });
		if (!reqs.length) {
			return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## No auto-roles\nThis server has no auto-roles configured. Use \`c.autorole create\` to add one.`)).setAccentColor(0xfee75c)], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
		}

		const activity = await db.prisma.guildMemberActivity.findUnique({ where: { guildId_userId: { guildId: guild.id, userId: targetId } } }).catch(() => null);
		const progress = {
			messageCount: activity?.messageCount ?? 0,
			voiceSeconds: activity?.voiceSeconds ?? 0,
			daysInServer: Math.floor((Date.now() - (member.joinedAt?.getTime() || Date.now())) / (1000 * 60 * 60 * 24)),
		};

		const totalPages = Math.max(1, Math.ceil(reqs.length / PAGE_SIZE));
		const page = 0;
		const container = buildProgressContainer(guild, member, reqs, progress, page, totalPages, targetId);
		const row = buildRow(guild.id, targetId, page, totalPages);

		return message.reply({ components: [container, row], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
	},
};
