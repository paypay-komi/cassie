const { getLogger } = require("../lib/logger");

module.exports = {
	name: "dependabot_alert",
	async execute(payload, client) {
		getLogger("GitHub").info("Received dependabot_alert event:", payload);
	},
};