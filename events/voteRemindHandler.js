const {
	Events,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	SectionBuilder,
	ThumbnailBuilder,
	ButtonBuilder,
	ActionRowBuilder,
	ButtonStyle,
	MessageFlags,
	time,
} = require("discord.js");

// In-memory reminders: userId -> Timeout
const reminders = new Map();
const db = require("../db");

async function scheduleVoteReminder(client, userId, remindAt) {
	const ms = Math.max(0, new Date(remindAt).getTime() - Date.now());
	if (reminders.has(userId)) {
		clearTimeout(reminders.get(userId));
		reminders.delete(userId);
	}
	const timeout = setTimeout(async () => {
		reminders.delete(userId);
		try {
			await db.prisma.voteReminder.delete({ where: { userId } }).catch(() => {});
		} catch {}
		try {
			const user = await client.users.fetch(userId).catch(() => null);
			if (!user) return;
			try {
				const prefs = await db.prisma.userVoteStats.findUnique({ where: { userId } });
				if (prefs?.voteDmOptOut) return;
			} catch {}
			const dm = await user.createDM().catch(() => null);
			if (!dm) return;
			const content = [
				`# ⏰ Time to vote again, ${user.username}!`,
				`It's been 12 hours since you last voted — your streak is waiting.`,
				`-# Voting helps Cassie grow and keeps your streak alive!`,
			].join("\n");
			const section = new SectionBuilder()
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
				.setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ dynamic: true, size: 1024 })));
			const container = new ContainerBuilder()
				.addSectionComponents(section)
				.addActionRowComponents(new ActionRowBuilder().addComponents(...buildAllVoteButtons()))
				.addActionRowComponents(
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId(`vote_remind:${userId}:12h`).setLabel("⏰ Remind again in 12h").setStyle(ButtonStyle.Secondary),
					),
				);
			container.setAccentColor?.(0x5865f2);
			await dm.send({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
		} catch {}
	}, ms);
	if (timeout.unref) timeout.unref();
	reminders.set(userId, timeout);
}

// (exports attached after handler definition below)

const SITE_VOTE_URLS = {
	discordbotlist: "https://discord.ly/cassie",
	topgg: "https://top.gg/bot/1461183051949412384",
	discordlistgg: "https://discordlist.gg/bot/1461183051949412384",
};
const SITE_DISPLAY_NAMES = {
	discordbotlist: "Discord Bot List",
	topgg: "top.gg",
	discordlistgg: "Discord List",
};
const buildAllVoteButtons = () =>
	Object.entries(SITE_VOTE_URLS)
		.filter(([, url]) => url)
		.map(([site, url]) =>
			new ButtonBuilder().setURL(url).setLabel(`vote on ${SITE_DISPLAY_NAMES[site] || site}`).setStyle(ButtonStyle.Link),
		);

const voteRemindHandler = {
	name: Events.InteractionCreate,
	async execute(client, interaction) {
		if (!interaction.isButton()) return;
		const id = interaction.customId || "";
		if (!id.startsWith("vote_remind:")) return;

		const [, userId, duration] = id.split(":");
		if (interaction.user.id !== userId) {
			return interaction.reply({ content: "This button isn't for you.", flags: MessageFlags.Ephemeral }).catch(() => {});
		}

		const ms = duration === "12h" ? 12 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
		const remindAt = new Date(Date.now() + ms);

		// Persist to DB (upsert, one per user)
		try {
			await db.prisma.voteReminder.upsert({
				where: { userId },
				update: { remindAt },
				create: { userId, remindAt },
			});
		} catch (e) {}

		await interaction.reply({
			content: `Got it — I'll DM you again ${time(remindAt, "R")} to remind you to vote!`,
			flags: MessageFlags.Ephemeral,
		}).catch(() => {});

		await scheduleVoteReminder(client, userId, remindAt);
	},
};

module.exports = voteRemindHandler;
module.exports.scheduleVoteReminder = scheduleVoteReminder;
module.exports.reminders = reminders;
