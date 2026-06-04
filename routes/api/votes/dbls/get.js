module.exports = {
	path: "/api/votes/dbl",
	method: "get",

	handler: (req, res) => {
		const ip =
			req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
			req.socket.remoteAddress;

		console.log(`[dbl] ping ${ip}`);

		res.json({
			ok: true,
			site: "dbl",
			uptime: process.uptime(),
			time: Date.now(),
		});
	},
};
