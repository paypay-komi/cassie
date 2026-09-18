const { Component, ComponentType, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, time } = require("discord.js");
const {
	Events,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Client,
	Message,
} = require("discord.js");
const db = require("../db");

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
		const c = new ContainerBuilder()
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Welcome back, ${user.displayName || user.username}!`))
			.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Your AFK has been removed.\nYou were gone for **${goneFor}** (since ${time(since, "R")}).\nNobody mentioned you while you were away.`))
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Reason:** ${afkData?.reason?.slice(0, 1000) || "No reason"}`))
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Since:** ${time(since)} (${time(since, "R")}) • **Duration:** ${goneFor}`));
		c.setAccentColor(0x5865f2);
		return c;
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
	const c = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Welcome back, ${user.displayName || user.username}!`))
		.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Your AFK has been removed. You were gone for **${goneFor}**.`))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Reason:** ${afkData?.reason?.slice(0, 1000) || "No reason"}`))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Since:** ${time(since)} (${time(since, "R")}) • **Duration:** ${goneFor}`))
		.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Mentions (${totalCount} from ${uniqueCount} users)\n${byUserSummary || "—"}`))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Recent mentions\n${lines.join("\n").slice(0, 3800) || "—"}`))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${totalCount > 10 ? `Showing 10 most recent of ${totalCount}` : `Total ${totalCount} mention(s)`}`));
	c.setAccentColor(0x5865f2);
	return c;
}

async function buildAfkSummaryContainer(user, afkData, mentions) {
	const since = afkData?.since ? new Date(afkData.since) : new Date();
	const goneFor = formatDuration(Date.now() - since.getTime());
	return buildAfkContainer(user, afkData, mentions, goneFor, since);
}
module.exports = {
	name: Events.MessageCreate,
	/**
	 *
	 * @param {Client} client
	 * @param {Message} message
	 * @returns
	 */
	async execute(client, message) {
		const user = message.author;

		if (!client.afk.has(user.id)) return;
		const afkData = client.afk.get(user.id);
		if (!afkData.SnoozeTime) afkData.SnoozeTime = Date.now();
		if (afkData.SnoozeTime > Date.now()) return;
		const afk_buttons = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`AFK_${user.id}_keep`)
				.setLabel("❎")
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId(`AFK_${user.id}_remove`)
				.setLabel("✅")
				.setStyle(ButtonStyle.Primary),
		);
		const interaction_message = await message.reply({
			content: "do you want to remove your afk",
			components: [afk_buttons],
		});
		const collector = interaction_message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60_000,
		}); // idle for 60 secounds
		collector.on("collect", async (interaction) => {
			const [_, collected_id, action] = interaction.customId.split("_");
			if (interaction.user.id != collected_id)
				return await interaction.reply({
					content: "this is not your button",
					flags: MessageFlags.Ephemeral,
				});
			if (action == "keep") {
				await interaction.reply({
					content: "got it snoozing this message for 1 minute",
					flags: MessageFlags.Ephemeral,
				});
				return collector.stop("kept");
			}
			if (action == "remove") {
				interaction.reply({
					content: "removing afk",
					flags: MessageFlags.Ephemeral,
				});
				return collector.stop("removed");
			}
		});
		collector.on("end", async (collected, reason) => {
			await interaction_message.delete().catch();

			if (reason == "kept") return;
			if (reason == "time") return;
			// Fetch summary before delete
			const afkDataSnapshot = client.afk.get(message.author.id);
			let mentions = [];
			try {
				mentions = await db.prisma.globalAfkMention.findMany({
					where: { userId: message.author.id },
					orderBy: { createdAt: "desc" },
					take: 20,
				});
			} catch {}
			try {
				await db.prisma.globalAfkUser.delete({ where: { userId: message.author.id } });
			} catch {}
			client.afk.delete(message.author.id);

			// Send welcome-back summary in same channel (Components V2)
			try {
				const container = await buildAfkSummaryContainer(message.author, afkDataSnapshot, mentions);
				await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
			} catch {}
		});
		afkData.SnoozeTime = Date.now() + 60_000;
	},
};
