const path = require("path");

module.exports = {
	path: "/guild/:guildId",
	method: "get",

	handler: (req, res) => {
		const session = req.session;

		if (!session?.user) {
			res.setHeader("Content-Type", "text/html");
			return res.status(401).send("<h1>Unauthorized</h1>");
		}

		res.sendFile(path.join(process.cwd(), "views", "guild.html"));
	},
};
