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

		this.voteHandler = async (vote) => {
			const vote_channel = await (
				await client.guilds.fetch("1489809097401307340")
			).channels.fetch("1505707808165855242");
			const user = await client.users.fetch(vote.id);
			if (!vote_channel?.isTextBased())
				return console.error("vote channel does not exist");
			const section = new SectionBuilder()
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						`thank you for voting <@${user.id}>`,
					),
				)
				.setThumbnailAccessory(
					new ThumbnailBuilder().setURL(
						user.displayAvatarURL({ dynamic: true, size: 1024 }),
					),
				);
			const containor = new ContainerBuilder()
				.addSectionComponents(section)
				.addActionRowComponents(
					new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setURL("https://discord.ly/cassie")
							.setLabel("vote here!!!")
							.setStyle(ButtonStyle.Link),
					),
				);
			if (!vote_channel.isSendable()) console.log("channel not sendable");
			vote_channel.send({
				components: [containor],
				flags: MessageFlags.IsComponentsV2,
			});
		};

		client.dbl.removeListener("vote", this.voteHandler);
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
