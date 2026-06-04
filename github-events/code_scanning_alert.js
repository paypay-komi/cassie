const { getLogger } = require("../lib/logger");

module.exports = {
	name: "code_scanning_alert",
	async execute(payload, client) {
		getLogger("GitHub").info("Received code_scanning_alert event:", payload);
	},
};
