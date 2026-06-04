const { getLogger } = require("../../../../lib/logger");

module.exports = {
	path: "/api/votes/dlistgg",
	method: "get",

	handler: (req, res) => {
		const ip =
			req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
			req.socket.remoteAddress;

		getLogger("Votes:DListGG").info(`Ping from ${ip}`);

		res.json({
			ok: true,
			site: "dlistgg",
			uptime: process.uptime(),
			time: Date.now(),
		});
	},
};
