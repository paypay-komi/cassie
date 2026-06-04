const { getLogger } = require("../lib/logger");

module.exports = {
	name: "watch",
	async execute(payload, client) {
		getLogger("GitHub").info("Received watch event:", payload);
	},
};
