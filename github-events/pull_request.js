const { getLogger } = require("../lib/logger");

module.exports = {
	name: "pull_request",
	async execute(payload, client) {
		getLogger("GitHub").info("Received pull_request event:", payload);
	},
};
