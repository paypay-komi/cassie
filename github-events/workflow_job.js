const { getLogger } = require("../lib/logger");

module.exports = {
	name: "workflow_job",
	async execute(payload, client) {
		getLogger("GitHub").info("Received workflow_job event:", payload);
	},
};
