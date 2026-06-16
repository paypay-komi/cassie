const db = require("../db");

module.exports = {
	path: "/invite",
	method: "get",

	handler: async (req, res) => {
		try {
			const ref = (req.query.ref || "").trim().slice(0, 100) || "unknown";
			const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
			const userAgent = (req.headers["user-agent"] || "").slice(0, 300) || null;

			await db.prisma.inviteClick.create({
				data: { ref, ip, userAgent },
			});

			const client = req.app?.locals?.client;
			const clientId = client?.user?.id || "1461183051949412384";
			const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

			res.redirect(302, inviteUrl);
		} catch (err) {
			console.error(err);
			const clientId = req.app?.locals?.client?.user?.id || "1461183051949412384";
			res.redirect(302, `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`);
		}
	},
};
