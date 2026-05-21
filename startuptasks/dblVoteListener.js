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
require("dotenv/config");

module.exports = {
	name: "dblVoteListener",
	prerequisites: ["startDbl"],
	reloadAble: true,

	server: null,
	app: null,
	voteHandler: null,
	/**
	 *
	 * @param {Client} client
	 */
	execute(client) {
		this.cleanUp(client);

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

			if (req.method === "OPTIONS") {
				return res.sendStatus(204);
			}

			next();
		});

		app.post("/dbl", client.dbl.webhook(process.env.DBL_WEBHOOK_SECRET));

		app.get("/", (req, res) => {
			res.send(`
				<!DOCTYPE html>
				<html>
					<head>
						<title>Cassie's Backend</title>
					</head>
					<body>
						<h1>DBL Vote Listener Running</h1>
					</body>
				</html>
			`);
		});
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
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(content),
				)
				.setThumbnailAccessory(
					new ThumbnailBuilder().setURL(
						user.displayAvatarURL({ dynamic: true, size: 1024 }),
					),
				);

		const buildActionRow = (...buttons) =>
			new ActionRowBuilder().addComponents(...buttons);

		this.voteHandler = async (vote) => {
			const guild = await client.guilds.fetch("1489809097401307340");
			const voteChannel = await guild.channels.fetch(
				"1505707808165855242",
			);

			if (!voteChannel?.isTextBased()) {
				return console.error("Vote channel does not exist.");
			}

			const user = await client.users.fetch(vote.id);

			// --- Shoutout message in vote channel ---
			const shoutoutContainer = new ContainerBuilder()
				.addSectionComponents(
					buildUserSection(
						user,
						`Thank you for voting <@${user.id}>!`,
					),
				)
				.addActionRowComponents(buildActionRow(buildVoteButton()));

			if (voteChannel.isSendable()) {
				await voteChannel.send({
					components: [shoutoutContainer],
					flags: MessageFlags.IsComponentsV2,
				});
			}

			// --- Thank you DM ---
			const dmContent = [
				"# Thank you for voting!",
				"When you vote, it motivates my owner a lot to keep going and helps me grow.",
				"-# PS: you also get a shoutout in her support server for voting!",
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
		};
		client.dbl.removeAllListeners("vote");

		client.dbl.on("vote", this.voteHandler);

		this.server = app.listen(3001, () => {
			console.log("DBL webhook listening on 3001");
		});
	},

	cleanUp(client) {
		if (this.server) {
			this.server.close();
		}

		if (this.voteHandler && client?.dbl) {
			client.dbl.removeListener("vote", this.voteHandler);
		}

		this.server = null;
		this.app = null;
		this.voteHandler = null;
	},
};
