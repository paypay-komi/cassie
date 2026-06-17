const fs = require("fs");
const path = require("path");

module.exports = {
	path: "/thank-you",
	method: "get",

	handler: async (req, res) => {
		res.sendFile(path.join(process.cwd(), "views", "thank-you.html"));
	},
};
