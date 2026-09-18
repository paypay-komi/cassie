const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const db = require("../../db");
const fs = require("fs");
const path = require("path");

function formatSeconds(s) {
	if (s < 60) return `${s}s`;
	if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	return `${h}h ${m}m`;
}

module.exports = {
	commandId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	name: "stats",
	description: "Show server statistics",
	dmUse: false,
	guildUse: true,
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],
	async execute(message, args, command, client) {
		const guild = message.guild;
		if (!guild) return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ❌ Server only`)).setAccentColor(0xed4245)], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });

		// --- Members (cache only) ---
		const totalMembers = guild.memberCount;
		const humans = guild.members.cache.filter((m) => !m.user.bot).size;
		const bots = guild.members.cache.filter((m) => m.user.bot).size;
		const online = guild.members.cache.filter((m) => m.presence?.status === "online" || m.presence?.status === "idle" || m.presence?.status === "dnd").size;
		const totalRoles = guild.roles.cache.size - 1;

		// --- Server info ---
		const boostCount = guild.premiumSubscriptionCount || 0;
		const boostTier = guild.premiumTier || 0;
		const verification = ["None", "Low", "Medium", "High", "Very High"][guild.verificationLevel] || "Unknown";
		const owner = await guild.fetchOwner().catch(() => null);
		const ownerStr = owner ? `${owner.user.username}` : guild.ownerId;
		const created = Math.floor(guild.createdAt.getTime() / 1000);

		// --- Channels ---
		const textChannels = guild.channels.cache.filter((c) => c.type === 0).size;
		const voiceChannels = guild.channels.cache.filter((c) => c.type === 2).size;
		const stageChannels = guild.channels.cache.filter((c) => c.type === 13).size;
		const forumChannels = guild.channels.cache.filter((c) => c.type === 15).size;
		const totalChannels = guild.channels.cache.size;

		// --- Emojis ---
		const emojiCount = guild.emojis.cache.size;

		// --- Activity aggregate ---
		const activityAgg = await db.prisma.$queryRaw`
			SELECT
				COALESCE(SUM("messageCount"), 0) AS "totalMessages",
				COALESCE(SUM("voiceSeconds"), 0) AS "totalVoice",
				COALESCE(COUNT(*), 0) AS "trackedUsers"
			FROM "GuildMemberActivity"
			WHERE "guildId" = ${guild.id}
		`.catch(() => [{ totalMessages: 0, totalVoice: 0, trackedUsers: 0 }]);
		const act = activityAgg[0] || { totalMessages: 0, totalVoice: 0, trackedUsers: 0 };

		// --- Top chatters ---
		const topChatters = await db.prisma.guildMemberActivity.findMany({
			where: { guildId: guild.id },
			orderBy: { messageCount: "desc" },
			take: 3,
		}).catch(() => []);
		const topChatterLines = topChatters
			.filter((t) => t.messageCount > 0)
			.map((t, i) => `${i + 1}. <@${t.userId}> — ${t.messageCount.toLocaleString()} msgs`)
			.join("\n");

		// --- Top voice ---
		const topVoice = await db.prisma.guildMemberActivity.findMany({
			where: { guildId: guild.id },
			orderBy: { voiceSeconds: "desc" },
			take: 3,
		}).catch(() => []);
		const topVoiceLines = topVoice
			.filter((t) => t.voiceSeconds > 0)
			.map((t, i) => `${i + 1}. <@${t.userId}> — ${formatSeconds(t.voiceSeconds)}`)
			.join("\n");

		// --- Autoroles ---
		const autoroleCount = await db.prisma.guildMemberRoleRequirement.count({
			where: { guildId: guild.id },
		}).catch(() => 0);

		// --- AFK ---
		const afkCount = await db.prisma.globalAfkUser.count().catch(() => 0);

		// --- Bans ---
		let banCount = 0;
		try {
			const bansFile = fs.readFileSync(path.join(__dirname, "../../data/botBans.json"), "utf8");
			const bans = JSON.parse(bansFile);
			banCount = Object.keys(bans.banned || {}).length;
		} catch {}

		// --- Tags ---
		const tagAgg = await db.prisma.guildTag.aggregate({
			where: { guildId: guild.id },
			_sum: { uses: true },
			_count: true,
		}).catch(() => ({ _sum: { uses: 0 }, _count: 0 }));
		const tagCount = tagAgg._count || 0;
		const tagUses = tagAgg._sum?.uses || 0;

		// --- Echo channels ---
		const echoCount = await db.prisma.echoChannel.count({
			where: { guildId: guild.id },
		}).catch(() => 0);

		// --- Disabled commands ---
		const disabledCount = await db.prisma.guildDisabledCommand.count({
			where: { guildId: guild.id },
		}).catch(() => 0);

		// --- Command access overrides ---
		const channelOverrides = await db.prisma.guildChannelCommandAccess.count({
			where: { guildId: guild.id },
		}).catch(() => 0);
		const roleOverrides = await db.prisma.guildRoleCommandAccess.count({
			where: { guildId: guild.id },
		}).catch(() => 0);
		const userOverrides = await db.prisma.guildUserCommandAccess.count({
			where: { guildId: guild.id },
		}).catch(() => 0);
		const totalOverrides = channelOverrides + roleOverrides + userOverrides;

		// --- Court cases ---
		const courtTotal = await db.prisma.courtCase.count({
			where: { guildId: guild.id },
		}).catch(() => 0);
		const courtOpen = await db.prisma.courtCase.count({
			where: { guildId: guild.id, status: "VOTING" },
		}).catch(() => 0);

		// --- Time capsules ---
		const capsulesPending = await db.prisma.timeCapsule.count({
			where: { sentAt: null },
		}).catch(() => 0);
		const capsulesSent = await db.prisma.timeCapsule.count({
			where: { sentAt: { not: null } },
		}).catch(() => 0);

		// --- Economy ---
		let economyLine = null;
		try {
			const econ = await db.prisma.guildEconomy.findUnique({ where: { guildId: guild.id } });
			if (econ && econ.enabled) {
				const totalBalance = await db.prisma.$queryRaw`
					SELECT COALESCE(SUM("balance"), 0) AS "total"
					FROM "GuildEconomyUser"
					WHERE "guildId" = ${guild.id}
				`.catch(() => [{ total: 0 }]);
				const userCount = await db.prisma.guildEconomyUser.count({ where: { guildId: guild.id } }).catch(() => 0);
				economyLine = `${econ.currencySymbol} **${econ.currencyName}** — ${totalBalance[0]?.total?.toLocaleString() || 0} total · ${userCount} users`;
			}
		} catch {}

		// --- Top commands ---
		const topCmds = await db.prisma.userCommandStats.findMany({
			where: { guildId: guild.id },
			orderBy: { count: "desc" },
			take: 3,
		}).catch(() => []);
		const topCmdLines = topCmds.map((c, i) => `${i + 1}. \`${c.commandName}\` — ${c.count.toLocaleString()}`).join("\n");

		// --- Top users by total command usage ---
		const topUsers = await db.prisma.userCommandStats.groupBy({
			where: { guildId: guild.id },
			by: ["userId"],
			_sum: { count: true },
			orderBy: { _sum: { count: "desc" } },
			take: 3,
		}).catch(() => []);
		const topUserLines = topUsers
			.filter((u) => (u._sum?.count || 0) > 0)
			.map((u, i) => `${i + 1}. <@${u.userId}> — ${(u._sum?.count || 0).toLocaleString()} cmds`)
			.join("\n");

		// --- Build container ---
		const container = new ContainerBuilder()
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📊 ${guild.name} Stats`))
			.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(
				`**Members:** ${totalMembers.toLocaleString()} (${humans.toLocaleString()} humans · ${bots.toLocaleString()} bots) · **Online:** ${online.toLocaleString()}\n` +
				`**Roles:** ${totalRoles} · **Channels:** ${totalChannels} (${textChannels} text · ${voiceChannels} voice · ${stageChannels} stage · ${forumChannels} forum)\n` +
				`**Emojis:** ${emojiCount} · **Boosts:** ${boostCount} (Tier ${boostTier}) · **Verification:** ${verification}\n` +
				`**Owner:** ${ownerStr} · **Created:** <t:${created}:R>`
			))
			.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(
				`**Tracked users:** ${Number(act.trackedUsers).toLocaleString()} · **Total messages:** ${Number(act.totalMessages).toLocaleString()} · **Total voice:** ${formatSeconds(Number(act.totalVoice))}`
			))
			.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(
				`**Auto-roles:** ${autoroleCount} · **Tags:** ${tagCount} (${tagUses.toLocaleString()} uses) · **Echo channels:** ${echoCount}\n` +
				`**AFK:** ${afkCount} active · **Bans:** ${banCount} · **Disabled cmds:** ${disabledCount} · **Perm overrides:** ${totalOverrides}\n` +
				`**Court cases:** ${courtTotal} (${courtOpen} open) · **Time capsules:** ${capsulesPending} pending · ${capsulesSent} sent`
			));

		if (economyLine) {
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true));
			container.addTextDisplayComponents(new TextDisplayBuilder().setContent(economyLine));
		}

		if (topChatterLines) {
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true));
			container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 💬 Top Chatters\n${topChatterLines}`));
		}

		if (topVoiceLines) {
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true));
			container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🎙️ Top Voice\n${topVoiceLines}`));
		}

		if (topCmdLines) {
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true));
			container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🔧 Top Commands\n${topCmdLines}`));
		}

		if (topUserLines) {
			container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true));
			container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 👤 Top Users\n${topUserLines}`));
		}

		container.setAccentColor(0x5865f2);

		return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
	},
};
