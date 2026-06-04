const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { getLogger } = require("../../../lib/logger");
const { getGitHubEvent } = require("../../../utils/githubEvents");

function verifySignature(rawBody, signature) {
	const secret = process.env.GITHUB_WEBHOOK_SECRET;
	if (!secret) {
		// No secret configured — skip verification
		return null;
	}

	const sig = signature?.split(",").find((s) => s.startsWith("sha256="));
	if (!sig) return false;

	const expected = crypto
		.createHmac("sha256", secret)
		.update(rawBody)
		.digest("hex");

	const received = sig.slice(7); // strip "sha256="

	try {
		return crypto.timingSafeEqual(
			Buffer.from(expected, "hex"),
			Buffer.from(received, "hex"),
		);
	} catch {
		return false;
	}
}

module.exports = {
	path: "/webhook/github",
	method: "post",

	middleware: [
		// Use raw body so we can verify HMAC signature before parsing
		require("express").raw({ type: "application/json" }),
	],

	handler: async (req, res) => {
		const log = getLogger("GitHubWebhook");
		const eventName = req.headers["x-github-event"] || "unknown";
		const rawBody = req.body;

		log.info(`Event: ${eventName}`);

		// Sanitize: only allow GitHub-standard event names
		// (lowercase alphanumeric + underscore, e.g. push, pull_request, code_scanning_alert)
		const safeEvent = eventName.replace(/[^a-z0-9_]/g, "");
		if (safeEvent !== eventName) {
			log.warn(`Suspicious event name rejected: "${eventName}"`);
			return res.sendStatus(400);
		}

		// Verify HMAC-SHA256 signature
		const sigHeader = req.headers["x-hub-signature-256"];
		const valid = verifySignature(rawBody, sigHeader);

		if (valid === false) {
			log.warn(`Bad signature for ${eventName}`);
			return res.sendStatus(401);
		}

		if (valid === null) {
			log.warn("No GITHUB_WEBHOOK_SECRET set — skipping signature verification");
		}

		// Safe to parse now
		let payload;
		try {
			payload = JSON.parse(rawBody);
		} catch {
			log.warn("Invalid JSON body");
			return res.sendStatus(400);
		}

		// Ack before processing (GitHub expects 200 quickly)
		res.sendStatus(200);

		const handler = getGitHubEvent(eventName);

		if (!handler) {
			log.warn(`Missing handler for ${eventName}`);

			const template = `
module.exports = {
	name: "${eventName}",
	async execute(payload, client) {
		const { getLogger } = require("../lib/logger");
		getLogger("GitHub").info("Received ${eventName} event:", payload);
	},
};
			`;

			const filePath = path.join(
				process.cwd(),
				"github-events",
				`${eventName}.js`
			);

			fs.writeFileSync(filePath, template);

			log.info(`Created handler for ${eventName}`);
			return;
		}

		try {
			await handler.execute(payload, req.client);
		} catch (err) {
			log.error(`Handler crash for ${eventName}:`, err);
		}
	},
};
