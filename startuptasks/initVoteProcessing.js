const {
	Client,
	SectionBuilder,
	TextDisplayBuilder,
	ThumbnailBuilder,
	ContainerBuilder,
	ButtonBuilder,
	ActionRowBuilder,
	ButtonStyle,
	MessageFlags,
} = require("discord.js");
const db = require("../db");
const voteEmitter = require("../utils/voteEmitter");

const STREAK_TIMEOUT = 24 * 60 * 60 * 1000;
let nextTimeout = null;

async function scheduleNextExpiry() {
	if (nextTimeout) clearTimeout(nextTimeout);

	const user = await db.prisma.dblVote.findFirst({
		where: { voteStreak: { gt: 0 } },
		orderBy: { lastVote: "asc" },
	});

	if (!user) return;

	const expiresAt = new Date(user.lastVote).getTime() + STREAK_TIMEOUT;
	const delay = Math.max(0, expiresAt - Date.now());

	nextTimeout = setTimeout(async () => {
		await db.prisma.dblVote.updateMany({
			where: {
				voteStreak: { gt: 0 },
				lastVote: { lt: new Date(Date.now() - STREAK_TIMEOUT) },
			},
			data: { voteStreak: 0 },
		});

		await scheduleNextExpiry();
	}, delay);
}

// Add your bot listing URLs here as you add vote sites
const SITE_VOTE_URLS = {
	discordbotlist: "https://discord.ly/cassie",
	// topgg: "https://top.gg/bot/1461183051949412384",
	discordlistgg: "https://discordlist.gg/bot/1461183051949412384",
};

const SITE_DISPLAY_NAMES = {
	discordbotlist: "Discord Bot List",
	// topgg: "top.gg",
	discordlistgg: "Discord List",
};

const buildAllVoteButtons = () =>
	Object.entries(SITE_VOTE_URLS)
		.filter(([, url]) => url)
		.map(([site, url]) =>
			new ButtonBuilder()
				.setURL(url)
				.setLabel(`vote on ${SITE_DISPLAY_NAMES[site] || site}`)
				.setStyle(ButtonStyle.Link),
		);

const buildSupportServerButton = () =>
	new ButtonBuilder()
		.setURL("https://discord.gg/udHtsDcPtW")
		.setLabel("join her support server")
		.setStyle(ButtonStyle.Link);

const buildUserSection = (user, content) =>
	new SectionBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
		.setThumbnailAccessory(
			new ThumbnailBuilder().setURL(
				user.displayAvatarURL({ dynamic: true, size: 1024 }),
			),
		);

const buildActionRow = (...buttons) =>
	new ActionRowBuilder().addComponents(...buttons);

module.exports = {
	name: "initVoteProcessing",
	description: "Listens for generic vote events and processes rewards",
	needsReadyClient: true,
	reloadAble: true,

	handler: null,
	client: null,

	execute(client) {
		this.client = client;
		this.cleanup();
		scheduleNextExpiry().catch(console.error);

		this.handler = async ({ userId, site }) => {
			try {
				const user = await client.users.fetch(userId);

				const existing = await db.prisma.dblVote.findFirst({
					where: { userId: user.id },
				});

				const hoursSinceLastVote =
					(Date.now() - new Date(existing?.lastVote)) /
					1000 /
					60 /
					60;
				const newStreak =
					!existing || hoursSinceLastVote > 24
						? 1
						: existing.voteStreak + 1;

				await db.prisma.dblVote.upsert({
					where: { userId: user.id },
					create: {
						userId: user.id,
						lastVote: new Date(),
						totalVotes: 1,
						voteStreak: 1,
						bestStreak: 1,
					},
					update: {
						lastVote: new Date(),
						totalVotes: { increment: 1 },
						voteStreak: newStreak,
						bestStreak: Math.max(
							newStreak,
							existing?.bestStreak ?? 0,
						),
					},
				});

				console.log(
					`[Vote] Processed vote for ${user.tag} via ${site}`,
				);

				// --- Shoutout in vote channel ---
				const guild = await client.guilds.fetch("1489809097401307340");
				const voteChannel = await guild.channels.fetch(
					"1505707808165855242",
				);

				if (!voteChannel?.isTextBased()) {
					return console.error("Vote channel does not exist.");
				}

			const siteLabel = SITE_DISPLAY_NAMES[site] || site;

			const shoutoutContainer = new ContainerBuilder()
				.addSectionComponents(
					buildUserSection(
						user,
						`# Thank you for voting on ${siteLabel} <@${user.id}>! \n streak: ${newStreak} \n total: ${(existing?.totalVotes ?? 0) + 1}`,
					),
				)
				.addActionRowComponents(
					buildActionRow(...buildAllVoteButtons()),
				);

				if (voteChannel.isSendable()) {
					await voteChannel.send({
						components: [shoutoutContainer],
						flags: MessageFlags.IsComponentsV2,
					});
				}

				// --- Thank you DM (skip if opted out) ---
				const prefs = await db.prisma.userVoteStats.findUnique({
					where: { userId: user.id },
				});
				if (prefs?.voteDmOptOut) {
					console.log(
						`Skipping vote DM for ${user.id} (opted out)`,
					);
					return;
				}

			const dmContent = [
				`# Thank you for voting on ${siteLabel}!`,
				"When you vote, it motivates my owner a lot to keep going and helps me grow.",
				"-# PS: you also get a shoutout in her support server for voting!",
				"",
				"-# — Cassie Bot  •  run `c.optout dms` to stop these",
			].join("\n");

			const dmContainer = new ContainerBuilder()
				.addSectionComponents(buildUserSection(user, dmContent))
				.addActionRowComponents(
					buildActionRow(
						...buildAllVoteButtons(),
						buildSupportServerButton(),
					),
				);

				try {
					const dm = await user.createDM();
					await dm.send({
						components: [dmContainer],
						flags: MessageFlags.IsComponentsV2,
					});
				} catch (error) {
					console.error(
						"Failed to send vote thank-you DM:",
						error,
					);
				}
			} catch (error) {
				console.error("Vote processing failed:", error);
			}
		};

		voteEmitter.on("vote", this.handler);
		console.log("✅ Vote processing initialized (listening on voteEmitter)");
	},

	cleanup() {
		if (this.handler) {
			voteEmitter.removeListener("vote", this.handler);
			this.handler = null;
		}
		if (nextTimeout) {
			clearTimeout(nextTimeout);
			nextTimeout = null;
		}
		this.client = null;
	},
};
