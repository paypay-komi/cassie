const { getLogger } = require("../lib/logger");

module.exports = {
	name: "check_suite",
	async execute(payload, client) {
		getLogger("GitHub").info("Received check_suite event:", payload);
	},
};
