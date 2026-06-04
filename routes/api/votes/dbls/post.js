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
		const t = Date.now();

		try {
			if (!req.body) {
				console.warn("[dbl] empty body");
				return res.sendStatus(400);
			}

			let data;

			try {
				data =
					typeof req.body === "string"
						? JSON.parse(req.body)
						: req.body;
			} catch {
				console.warn("[dbl] bad payload");
				return res.sendStatus(400);
			}

			if (!data?.user) {
				console.warn("[dbl] missing user");
				return res.sendStatus(400);
			}

			if (!data?.isVote) {
				console.warn(`[dbl] ignored ${data.user}`);
				return res.sendStatus(400);
			}

			console.log(`[dbl] vote ${data.user}`);

			voteEmitter.emit("vote", {
				userId: data.user,
				site: "discordlistgg",
			});

			console.log(`[dbl] ok ${Date.now() - t}ms`);

			return res.sendStatus(200);
		} catch (err) {
			console.error("[dbl] crash:", err);
			return res.sendStatus(500);
		}
	},
};
