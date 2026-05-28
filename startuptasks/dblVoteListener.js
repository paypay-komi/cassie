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
const express = require("express");
const db = require("../db");
require("dotenv/config");

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

const buildVoteButton = () =>
	new ButtonBuilder()
		.setURL("https://discord.ly/cassie")
		.setLabel("vote here!!!")
		.setStyle(ButtonStyle.Link);

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
	name: "dblVoteListener",
	prerequisites: ["startDbl"],
	reloadAble: true,

	server: null,
	app: null,
	voteHandler: null,

	/**
	 * @param {Client} client
	 */
	execute(client) {
		this.cleanUp(client);
		scheduleNextExpiry().catch(console.error);

		const app = express();
		this.app = app;

		app.use(express.json());

		app.use((req, res, next) => {
			res.header("Access-Control-Allow-Origin", "*");
			res.header(
				"Access-Control-Allow-Headers",
				"Authorization, Content-Type, X-DBL-Signature",
			);
			res.header("Access-Control-Allow-Methods", "POST, OPTIONS");

			if (req.method === "OPTIONS") return res.sendStatus(204);

			next();
		});

		app.post("/dbl", client.dbl.webhook(process.env.DBL_WEBHOOK_SECRET));

		app.get("/", (req, res) => {
			res.send(`
				<!DOCTYPE html>
				<html>
					<head><title>Cassie's Backend</title></head>
					<body><h1>DBL Vote Listener Running</h1></body>
				</html>
			`);
		});

		this.voteHandler = async (vote) => {
			try {
				const user = await client.users.fetch(vote.id);

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

				console.log(`Processed vote for ${user.tag}`);

				// --- Shoutout in vote channel ---
				const guild = await client.guilds.fetch("1489809097401307340");
				const voteChannel = await guild.channels.fetch(
					"1505707808165855242",
				);

				if (!voteChannel?.isTextBased()) {
					return console.error("Vote channel does not exist.");
				}

				const shoutoutContainer = new ContainerBuilder()
					.addSectionComponents(
						buildUserSection(
							user,
							`# Thank you for voting <@${user.id}>! \n streak: ${newStreak} \n total: ${(existing?.totalVotes ?? 0) + 1}`,
						),
					)
					.addActionRowComponents(buildActionRow(buildVoteButton()));

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
				console.log(`Skipping vote DM for ${user.id} (opted out)`);
				return;
			}

			const dmContent = [
				"# Thank you for voting!",
				"When you vote, it motivates my owner a lot to keep going and helps me grow.",
				"-# PS: you also get a shoutout in her support server for voting!",
				"",
				"-# — Cassie Bot  •  run `c.optout dms` to stop these",
			].join("\n");

			const dmContainer = new ContainerBuilder()
				.addSectionComponents(buildUserSection(user, dmContent))
				.addActionRowComponents(
					buildActionRow(
						buildVoteButton(),
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
				console.error("Failed to send vote thank-you DM:", error);
			}
			} catch (error) {
				console.error("Vote handler failed:", error);
			}
		};

		client.dbl.on("vote", this.voteHandler);

		this.server = app.listen(3001, () => {
			console.log("DBL vote listener running on port 3000");
		});
	},

	cleanUp(client) {
		if (this.server) this.server.close();

		if (this.voteHandler && client?.dbl) {
			client.dbl.removeListener("vote", this.voteHandler);
		}

		this.server = null;
		this.app = null;
		this.voteHandler = null;
	},
};
