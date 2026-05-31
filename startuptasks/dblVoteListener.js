const express = require("express");
const voteEmitter = require("../utils/voteEmitter");
require("dotenv/config");

module.exports = {
	name: "dblVoteListener",
	description: "Starts the Discord Bot List vote webhook server",
	prerequisites: ["startDbl"],
	reloadAble: true,

	server: null,
	app: null,

	/**
	 * @param {Client} client
	 */
	execute(client) {
		this.cleanup();

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

		client.dbl.on("vote", (vote) => {
			voteEmitter.emit("vote", {
				userId: vote.id,
				site: "discordbotlist",
			});
		});

		this.server = app.listen(3001, () => {
			console.log("DBL vote listener running on port 3001");
		});
	},

	cleanup() {
		if (this.server) this.server.close();
		this.server = null;
		this.app = null;
	},
};
