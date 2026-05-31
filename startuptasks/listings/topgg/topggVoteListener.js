const crypto = require("crypto");
const express = require("express");
const voteEmitter = require("../utils/voteEmitter");
require("dotenv/config");

/**
 * Verify a v1 top.gg webhook using x-topgg-signature HMAC-SHA256.
 */
function verifyV1Signature(rawBody, signatureHeader, secret) {
	if (!signatureHeader || !secret) return false;

	const parts = signatureHeader.split(",");
	const tPart = parts.find((p) => p.startsWith("t="));
	const v1Part = parts.find((p) => p.startsWith("v1="));
	if (!tPart || !v1Part) return false;

	const timestamp = tPart.slice(2);
	const receivedSig = v1Part.slice(3);

	const expected = crypto
		.createHmac("sha256", secret)
		.update(`${timestamp}.${rawBody}`)
		.digest("hex");

	try {
		return crypto.timingSafeEqual(
			Buffer.from(expected, "hex"),
			Buffer.from(receivedSig, "hex"),
		);
	} catch {
		return false;
	}
}

module.exports = {
	name: "topggVoteListener",
	description: "Starts the top.gg vote webhook endpoint",
	reloadAble: true,

	server: null,
	app: null,

	execute(client) {
		this.cleanup();

		const secret = process.env.TOPGG_WEBHOOK_SECRET;
		if (!secret) {
			console.warn(
				"[Top.gg] No TOPGG_WEBHOOK_SECRET set — vote webhook not registered",
			);
			return;
		}

		const app = express();
		this.app = app;

		// Capture raw body as text for v1 signature verification.
		// The route handler decides how to parse it.
		app.use(express.text({ type: "*/*" }));

		app.post("/topgg", (req, res) => {
			const rawBody = req.body; // string from express.text()
			const contentType = req.get("Content-Type") || "";

			// --- v1: verify x-topgg-signature HMAC ---
			const sigHeader = req.get("x-topgg-signature");
			let userId = null;
			let payload = null;

			if (verifyV1Signature(rawBody, sigHeader, secret)) {
				try {
					payload = JSON.parse(rawBody);
					// v1 payload: { type, data: { user: { platform_id } } }
					if (payload.data?.user?.platform_id) {
						userId = payload.data.user.platform_id;
					}
				} catch {
					return res.status(400).json({ error: "Invalid JSON body" });
				}
			}

			// --- Fallback: v0 legacy Authorization check ---
			if (!userId && req.headers.authorization === secret) {
				try {
					payload = JSON.parse(rawBody);
					// v0 payload: { bot, user, type, isWeekend, query }
					if (payload.user) {
						userId = payload.user;
					}
				} catch {
					return res.status(400).json({ error: "Invalid JSON body" });
				}
			}

			if (!userId) {
				console.warn(
					"[Top.gg] Unauthorized webhook request — signature mismatch",
				);
				return res.status(403).json({ error: "Unauthorized" });
			}

			// Silence test events from the dashboard
			const eventType = payload.type || payload.data?.type;
			if (eventType === "test" || eventType === "webhook.test") {
				console.log("[Top.gg] Received test vote — acknowledged");
				return res.status(200).send("OK");
			}

			voteEmitter.emit("vote", {
				userId,
				site: "topgg",
			});

			console.log(`[Top.gg] Processed vote from ${userId}`);
			res.status(200).send("OK");
		});

		app.get("/", (req, res) => {
			res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Cassie's Backend</title></head>
          <body><h1>top.gg Vote Listener Running</h1></body>
        </html>
      `);
		});

		this.server = app.listen(3003, () => {
			console.log("[Top.gg] Vote webhook running on port 3003");
		});
	},

	cleanup() {
		if (this.server) this.server.close();
		this.server = null;
		this.app = null;
	},
};
