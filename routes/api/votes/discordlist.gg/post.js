const jwt = require("jsonwebtoken");
const { getLogger } = require("../../../../lib/logger");
const voteEmitter = require("../../../../utils/voteEmitter");
require("dotenv/config");

module.exports = {
	path: "/api/votes/dlistgg",
	method: "post",

	handler: (req, res) => {
		const log = getLogger("Votes:DListGG");
		const secret = process.env.DLISTGG_WEBHOOK_AUTH;

		if (!secret) {
			log.warn("Missing webhook secret");
			return res.sendStatus(500);
		}

		if (!req.rawBody) {
			log.warn("Empty body");
			return res.sendStatus(400);
		}

		let decoded;

		try {
			decoded = jwt.verify(req.rawBody, secret);
		} catch (err) {
			log.warn("Bad JWT");
			return res.sendStatus(401);
		}

		if (decoded.is_test) {
			log.info("Test webhook");
			return res.sendStatus(200);
		}

		if (!decoded.user_id) {
			log.warn("Missing user in payload");
			return res.sendStatus(400);
		}

		log.info(`Vote from ${decoded.user_id}`);

		voteEmitter.emit("vote", {
			userId: decoded.user_id,
			site: "discordlistgg",
		});

		return res.json({
			ok: true,
		});
	},
};
