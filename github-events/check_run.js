const { getLogger } = require("../lib/logger");

module.exports = {
	name: "check_run",
	async execute(payload, client) {
		getLogger("GitHub").info("Received check_run event:", payload);
	},
};
