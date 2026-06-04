const { getLogger } = require("../../../../lib/logger");
const voteEmitter = require("../../../../utils/voteEmitter");
const express = require("express");

const DBL_SECRET = process.env.DBL_WEBHOOK_SECRET;

function verifyAuth(req) {
	const auth = req.headers["auth"] || req.headers["authorization"];
	if (!auth) return false;

	const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

	return token === DBL_SECRET;
}

module.exports = {
	path: "/api/votes/dbl",
	method: "post",

	middleware: [express.json()],

	handler: (req, res) => {
		const log = getLogger("Votes:DBL");

		try {
			if (!verifyAuth(req)) {
				log.warn("Invalid auth token");
				return res.sendStatus(401);
			}

			const data = req.body;

			if (!data?.id) return res.sendStatus(400);

			log.info(`Vote from ${data.id}`);

			voteEmitter.emit("vote", {
				userId: data.id,
				site: "Discord Bot List",
			});

			return res.sendStatus(200);
		} catch (err) {
			log.error(err);
			return res.sendStatus(500);
		}
	},
};
