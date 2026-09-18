const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	MessageFlags,
	time,
} = require("discord.js");
const db = require("../../../db");

function formatDuration(ms) {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	const s = sec % 60;
	if (min < 60) return `${min}m ${s}s`;
	const hr = Math.floor(min / 60);
	const m = min % 60;
	if (hr < 24) return `${hr}h ${m}m${s ? ` ${s}s` : ""}`;
	const d = Math.floor(hr / 24);
	const h = hr % 24;
	return `${d}d ${h}h ${m}m`;
}

function buildAfkContainer(user, afkData, mentions, goneFor, since) {
	if (!mentions.length) {
		const container = new ContainerBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`## Welcome back, ${user.displayName || user.username}!`),
			)
			.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`Your AFK has been removed.\nYou were gone for **${goneFor}** (since ${time(since, "R")}).\nNobody mentioned you while you were away.`,
				),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`**Reason:** ${afkData?.reason?.slice(0, 1000) || "No reason"}`),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`**Since:** ${time(since)} (${time(since, "R")}) • **Duration:** ${goneFor}`),
			);
		container.setAccentColor(0x5865f2);
		return container;
	}

	const byUser = new Map();
	for (const m of mentions) {
		if (!byUser.has(m.mentionedBy)) byUser.set(m.mentionedBy, []);
		byUser.get(m.mentionedBy).push(m);
	}
	const uniqueCount = byUser.size;
	const totalCount = mentions.length;
	const lines = [];
	for (const m of mentions.slice(0, 10)) {
		const when = time(new Date(m.createdAt), "R");
		const link = m.guildId !== "DM"
			? `https://discord.com/channels/${m.guildId}/${m.channelId}/${m.messageId}`
			: `https://discord.com/channels/@me/${m.channelId}/${m.messageId}`;
		lines.push(`<@${m.mentionedBy}> ${when} in <#${m.channelId}> — [Jump](${link})`);
	}
	if (mentions.length > 10) lines.push(`*+ ${mentions.length - 10} more...*`);
	const byUserSummary = [...byUser.entries()].map(([uid, arr]) => `<@${uid}> ×${arr.length}`).join(", ").slice(0, 1000);

	const container = new ContainerBuilder()
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`## Welcome back, ${user.displayName || user.username}!`),
		)
		.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`Your AFK has been removed. You were gone for **${goneFor}**.`),
		)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`**Reason:** ${afkData?.reason?.slice(0, 1000) || "No reason"}`),
		)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`**Since:** ${time(since)} (${time(since, "R")}) • **Duration:** ${goneFor}`),
		)
		.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`### Mentions (${totalCount} from ${uniqueCount} users)\n${byUserSummary || "—"}`),
		)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`### Recent mentions\n${lines.join("\n").slice(0, 3800) || "—"}`),
		)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`-# ${totalCount > 10 ? `Showing 10 most recent of ${totalCount}` : `Total ${totalCount} mention(s)`}`),
		);
	container.setAccentColor(0x5865f2);
	return container;
}

module.exports = {
	commandId: "e0712c98-e91c-4b4c-a873-1bf5e3cff84e",
	name: "remove",
	description: "removes your current afk if you have one",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	parent: "afk",

	async execute(message, args) {
		const client = message.client;
		const userId = message.author.id;
		if (!client.afk.has(userId)) {
			return message.reply("You don't have an afk set maybe you forgot to do afk set?");
		}

		const afkData = client.afk.get(userId);
		const since = afkData?.since ? new Date(afkData.since) : new Date();
		const goneForMs = Date.now() - since.getTime();
		const goneFor = formatDuration(goneForMs);

		// Fetch mentions before delete (cascade will remove them)
		let mentions = [];
		try {
			mentions = await db.prisma.globalAfkMention.findMany({
				where: { userId },
				orderBy: { createdAt: "desc" },
				take: 20,
			});
		} catch {}

		// Delete AFK (cascade deletes mentions)
		try {
			await db.prisma.globalAfkUser.delete({ where: { userId } });
		} catch {}
		client.afk.delete(userId);

		const container = buildAfkContainer(message.author, afkData, mentions, goneFor, since);
		return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
	},
};
