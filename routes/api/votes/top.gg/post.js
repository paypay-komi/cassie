const crypto = require("crypto");
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

	middleware: [require("express").text({ type: "*/*" })],

	handler: (req, res) => {
		const secret = process.env.TOPGG_WEBHOOK_SECRET;

		const rawBody = req.body;
		let payload;
		let userId;

		try {
			if (!rawBody) {
				console.warn("[topgg] empty body");
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
				console.warn("[topgg] bad signature");
				return res.sendStatus(403);
			}

			const type = payload?.type || payload?.data?.type;

			if (type === "test" || type === "webhook.test") {
				console.log("[topgg] test");
				return res.sendStatus(200);
			}

			console.log(`[topgg] vote ${userId}`);

			voteEmitter.emit("vote", {
				userId,
				site: "topgg",
			});

			return res.sendStatus(200);
		} catch (err) {
			console.error("[topgg] crash:", err);
			return res.sendStatus(500);
		}
	},
};
