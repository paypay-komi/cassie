const jwt = require("jsonwebtoken");
const voteEmitter = require("../../../../utils/voteEmitter");
require("dotenv/config");

module.exports = {
	path: "/api/votes/dlistgg",
	method: "post",

	middleware: [require("express").text({ type: "*/*" })],

	handler: (req, res) => {
		const secret = process.env.DLISTGG_WEBHOOK_AUTH;

		if (!secret) {
			console.warn("[dlistgg] missing secret");
			return res.sendStatus(500);
		}

		if (!req.body) {
			console.warn("[dlistgg] empty body");
			return res.sendStatus(400);
		}

		let decoded;

		try {
			decoded = jwt.verify(req.body, secret);
		} catch (err) {
			console.warn("[dlistgg] bad jwt");
			return res.sendStatus(401);
		}

		if (decoded.is_test) {
			console.log("[dlistgg] test");
			return res.sendStatus(200);
		}

		if (!decoded.user_id) {
			console.warn("[dlistgg] missing user");
			return res.sendStatus(400);
		}

		console.log(`[dlistgg] vote ${decoded.user_id}`);

		voteEmitter.emit("vote", {
			userId: decoded.user_id,
			site: "discordlistgg",
		});

		return res.json({
			ok: true,
		});
	},
};
