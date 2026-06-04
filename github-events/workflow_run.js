const { getLogger } = require("../lib/logger");

module.exports = {
	name: "workflow_run",
	async execute(payload, client) {
		getLogger("GitHub").info("Received workflow_run event:", payload);
	},
};
