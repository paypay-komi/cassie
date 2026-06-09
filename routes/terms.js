const path = require("path");

module.exports = {
	path: "/terms",
	method: "get",

	handler: (req, res) => {
		res.sendFile(path.join(process.cwd(), "views", "terms.html"));
	},
};
