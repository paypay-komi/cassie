const path = require("path");

module.exports = {
	path: "/privacy",
	method: "get",

	handler: (req, res) => {
		res.sendFile(path.join(process.cwd(), "views", "privacy.html"));
	},
};
