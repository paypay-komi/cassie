const crypto = require("crypto");
const { getLogger } = require("../../../../lib/logger");
const voteEmitter = require("../../../../utils/voteEmitter");

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
	path: "/api/votes/topgg",
	method: "post",

	handler: (req, res) => {
		const log = getLogger("Votes:TopGG");
		const secret = process.env.TOPGG_WEBHOOK_SECRET;

		const rawBody = req.rawBody;
		let payload;
		let userId;

		try {
			if (!rawBody) {
				log.warn("Empty body");
				return res.sendStatus(400);
			}

			const sig = req.get("x-topgg-signature");

			// --- v1 signature ---
			if (verifyV1Signature(rawBody, sig, secret)) {
				payload = JSON.parse(rawBody);
				userId = payload?.data?.user?.platform_id;
			}

			// --- fallback v0 ---
			if (!userId && req.headers.authorization === secret) {
				payload = JSON.parse(rawBody);
				userId = payload?.user;
			}

			if (!userId) {
				log.warn("Bad signature");
				return res.sendStatus(403);
			}

			const type = payload?.type || payload?.data?.type;

			if (type === "test" || type === "webhook.test") {
				log.info("Test webhook received");
				return res.sendStatus(200);
			}

			log.info(`Vote from ${userId}`);

			voteEmitter.emit("vote", {
				userId,
				site: "topgg",
			});

			return res.sendStatus(200);
		} catch (err) {
			log.error("Crash:", err);
			return res.sendStatus(500);
		}
	},
};
