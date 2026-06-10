const path = require("path");
const { requireGuildAccess } = require("../lib/guildGuard");

module.exports = {
	path: "/guild/:guildId",
	method: "get",

	handler: async (req, res) => {
		const session = req.session;

		if (!session?.user) {
			res.setHeader("Content-Type", "text/html");
			return res.status(401).send("<h1>Unauthorized</h1>");
		}

		const guard = await requireGuildAccess(session, req.params.guildId, req.app?.locals?.client);
		if (!guard.ok) {
			const messages = {
				404: "Guild not found or the bot is not in it.",
				403: "You need the <strong>Manage Server</strong> permission to access this page.",
				401: "Session expired, please <a href='/login'>re-login</a>.",
			};
			const msg =
				messages[guard.status] || `Access denied (${guard.error})`;
			res.setHeader("Content-Type", "text/html");
			return res
				.status(guard.status)
				.send(`<h1>${guard.status}</h1><p>${msg}</p><a href="/dashboard">← Back</a>`);
		}

		res.sendFile(path.join(process.cwd(), "views", "guild.html"));
	},
};
