const { getLogger } = require("../lib/logger");

module.exports = {
	name: "create",
	async execute(payload, client) {
		getLogger("GitHub").info("Received create event:", payload);
	},
};
