const express = require("express");
const jwt = require("jsonwebtoken");
const voteEmitter = require("../utils/voteEmitter");
require("dotenv/config");

module.exports = {
	name: "dlistggVoteListener",
	description: "Starts the discordlist.gg vote webhook server",
	reloadAble: true,

	server: null,
	app: null,

	execute(client) {
		this.cleanup();

		const app = express();
		this.app = app;

		// Body is a raw JWT string, not JSON
		app.use(express.text({ type: "*/*" }));

		app.post("/dlistgg", (req, res) => {
			const secret = process.env.DLISTGG_WEBHOOK_AUTH;

			if (!secret) {
				console.warn("[DlistGG] No DLISTGG_WEBHOOK_AUTH set — skipping verification");
				return res.status(500).send("Server not configured");
			}

			if (!req.body) {
				console.warn("[DlistGG] No body received");
				return res.status(400).send("No body");
			}

			let decoded;
			try {
				decoded = jwt.verify(req.body, secret);
			} catch (err) {
				console.error("[DlistGG] JWT verification failed:", err.message);
				return res.status(401).send("Unauthorized");
			}

			// decoded = { user_id, bot_id, is_test }
			if (decoded.is_test) {
				console.log("[DlistGG] Received test vote");
				return res.status(200).send("OK");
			}

			if (!decoded.user_id) {
				return res.status(400).send("Missing user_id");
			}

			voteEmitter.emit("vote", {
				userId: decoded.user_id,
				site: "discordlistgg",
			});

			console.log(`[DlistGG] Processed vote from ${decoded.user_id}`);
			res.status(200).json({ status: 200, message: "Vote processed" });
		});

		app.get("/", (req, res) => {
			res.send(`
				<!DOCTYPE html>
				<html>
					<head><title>Cassie's Backend</title></head>
					<body><h1>Discordlist.gg Vote Listener Running</h1></body>
				</html>
			`);
		});

		this.server = app.listen(3002, () => {
			console.log("Discordlist.gg vote webhook running on port 3002");
		});
	},

	cleanup() {
		if (this.server) this.server.close();
		this.server = null;
		this.app = null;
	},
};
