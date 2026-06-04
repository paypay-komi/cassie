module.exports = {
	path: "/api/votes/topgg",
	method: "get",

	handler: (req, res) => {
		const ip =
			req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
			req.socket.remoteAddress;

		console.log(`[topgg] ping ${ip}`);

		res.json({
			ok: true,
			site: "topgg",
			uptime: process.uptime(),
			time: Date.now(),
		});
	},
};
