// GLOBAL EVENT LISTENER — always running, no timeout
// Tracks per-message pagination state via button customIds (guildId:userId:page)
// Every single progress message uses this handler, no collectors, no expiry
const { Events, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../db");
const { analyzeNode, formatLeafProgress, formatClosest, progressBar } = require("../lib/autoroleProgressHelper");
const { getLogger } = require("../lib/logger");
const log = getLogger("autoroleProgress");

const PAGE_SIZE = 3; // roles per page

function buildProgressContainer(guild, member, reqs, progress, page, totalPages, requesterId) {
	const start = page * PAGE_SIZE;
	const slice = reqs.slice(start, start + PAGE_SIZE);

	const lines = [];
	let metCountOverall = 0;
	for (const r of reqs) {
		try {
			const { evaluateRequirement } = require("../lib/roleRequirementEvaluator");
			if (evaluateRequirement(r.ast, progress)) metCountOverall++;
		} catch {}
	}

	const container = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📊 Auto-Role Progress — Page ${page + 1}/${totalPages}`))
		.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**You:** <@${requesterId}> • **Server:** ${guild.name}\n**Your stats:** \`messageCount: ${progress.messageCount}\` • \`voiceSeconds: ${progress.voiceSeconds} (${Math.floor(progress.voiceSeconds / 60)}m)\` • \`daysInServer: ${progress.daysInServer}\` • **${metCountOverall}/${reqs.length} met**`))
		.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true));

	if (!slice.length) {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`No roles on this page.`));
	} else {
		for (const r of slice) {
			const role = guild.roles.cache.get(r.roleId);
			const roleStr = role ? `${role}` : `<@&${r.roleId}>`;
			const hasRole = member.roles.cache.has(r.roleId) ? " ✅ you have it" : "";
			const analysis = analyzeNode(r.ast, progress);
			const overallPct = Math.round(analysis.progress * 100);
			const overallBar = progressBar(analysis.progress);
			const status = analysis.met ? "✅ **Met**" : "❌ **Not yet**";
			const closest = formatClosest(analysis.missing);

			const leafLines = analysis.leaves.map((lp) => `  ${formatLeafProgress(lp)}`).join("\n");
			const block = `**${roleStr}**${hasRole} — ${status} ${overallBar} **${overallPct}%**\n\`${r.expression}\`\n${leafLines}\n-# ${closest}`;
			container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block.slice(0, 3800)));
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(false));
		}
	}

	// Remove last separator if added
	// (ContainerBuilder doesn't easily allow pop, so we just leave it)

	container.setAccentColor(metCountOverall === reqs.length ? 0x57f287 : 0x5865f2);
	return container;
}

function buildRow(guildId, userId, page, totalPages) {
	const prevDisabled = page <= 0;
	const nextDisabled = page >= totalPages - 1;
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`autorole_progress:prev:${guildId}:${userId}:${page}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(prevDisabled),
		new ButtonBuilder().setCustomId(`autorole_progress:refresh:${guildId}:${userId}:${page}`).setLabel("🔄 Refresh").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId(`autorole_progress:next:${guildId}:${userId}:${page}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(nextDisabled),
		new ButtonBuilder().setCustomId(`autorole_progress:close:${guildId}:${userId}:${page}`).setLabel("✕ Close").setStyle(ButtonStyle.Danger),
	);
}

module.exports = {
	name: Events.InteractionCreate,
	async execute(client, interaction) {
		if (!interaction.isButton()) return;
		const id = interaction.customId || "";
		if (!id.startsWith("autorole_progress:")) return;

		// Parse: autorole_progress:action:guildId:userId:page
		const parts = id.split(":");
		if (parts.length < 5) return;
		const [, action, guildId, ownerId, pageStr] = parts;
		const page = parseInt(pageStr, 10) || 0;

		// Only owner can paginate (or allow anyone but show their own progress? Restrict to owner for now)
		if (interaction.user.id !== ownerId) {
			return interaction.reply({ content: `This pagination is for <@${ownerId}> only. Run \`/autorole progress\` to see your own.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});
		}

		const guild = interaction.guild || await client.guilds.fetch(guildId).catch(() => null);
		if (!guild) return interaction.reply({ content: "Guild not found.", flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});

		const member = await guild.members.fetch(ownerId).catch(() => null);
		if (!member) return interaction.reply({ content: "Member not found.", flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => {});

		if (action === "close") {
			try { await interaction.message.delete().catch(() => {}); } catch {}
			return interaction.deferUpdate().catch(() => {});
		}

		// Fetch fresh data on every click (no timeout, always accurate)
		const reqs = await client.db.prisma.guildMemberRoleRequirement.findMany({ where: { guildId }, orderBy: { createdAt: "asc" } }).catch(() => []);
		if (!reqs.length) {
			return interaction.update({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## No auto-roles`)).setAccentColor(0xfee75c)], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
		}

		const activity = await client.db.prisma.guildMemberActivity.findUnique({ where: { guildId_userId: { guildId, userId: ownerId } } }).catch(() => null);
		const progress = {
			messageCount: activity?.messageCount ?? 0,
			voiceSeconds: activity?.voiceSeconds ?? 0,
			daysInServer: Math.floor((Date.now() - (member.joinedAt?.getTime() || Date.now())) / (1000 * 60 * 60 * 24)),
		};

		const totalPages = Math.max(1, Math.ceil(reqs.length / PAGE_SIZE));
		let newPage = page;
		if (action === "prev") newPage = Math.max(0, page - 1);
		if (action === "next") newPage = Math.min(totalPages - 1, page + 1);
		// refresh stays on same page

		const container = buildProgressContainer(guild, member, reqs, progress, newPage, totalPages, ownerId);
		const row = buildRow(guildId, ownerId, newPage, totalPages);

		try {
			await interaction.update({ components: [container, row], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
		} catch (err) {
			log.error("Failed to update autorole progress pagination:", err);
			try { await interaction.reply({ content: "Failed to update. Try again.", flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }); } catch {}
		}
	},
};

// Export for command to reuse
module.exports.buildProgressContainer = buildProgressContainer;
module.exports.buildRow = buildRow;
module.exports.PAGE_SIZE = PAGE_SIZE;
