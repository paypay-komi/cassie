const { getLogger } = require("../lib/logger");

module.exports = {
	name: "label",
	async execute(payload, client) {
		getLogger("GitHub").info("Received label event:", payload);
	},
};