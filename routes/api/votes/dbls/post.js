const { getLogger } = require("../../../../lib/logger");
const voteEmitter = require("../../../../utils/voteEmitter");

module.exports = {
	path: "/api/votes/dbl",
	method: "post",

	middleware: [
		require("express").text({ type: "*/*" }),

		(req, res, next) => {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "Content-Type");
			res.header("Access-Control-Allow-Methods", "POST, OPTIONS");

			if (req.method === "OPTIONS") return res.status(204).end();
			next();
		},
	],

	handler: (req, res) => {
		const log = getLogger("Votes:DBL");
		const t = Date.now();

		try {
			if (!req.body) {
				log.warn("Empty body");
				return res.sendStatus(400);
			}

			let data;

			try {
				data =
					typeof req.body === "string"
						? JSON.parse(req.body)
						: req.body;
			} catch {
				log.warn("Bad payload");
				return res.sendStatus(400);
			}

			if (!data?.user) {
				log.warn("Missing user");
				return res.sendStatus(400);
			}

			if (!data?.isVote) {
				log.warn(`Ignored non-vote from ${data.user}`);
				return res.sendStatus(400);
			}

			log.info(`Vote from ${data.user}`);

			voteEmitter.emit("vote", {
				userId: data.user,
				site: "discordlistgg",
			});

			log.info(`OK (${Date.now() - t}ms)`);

			return res.sendStatus(200);
		} catch (err) {
			log.error("Crash:", err);
			return res.sendStatus(500);
		}
	},
};
