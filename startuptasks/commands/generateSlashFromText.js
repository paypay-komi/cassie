const autoGenerateSlashData = require("../../startup-lib/autoGenerateSlashData");
const { getLogger } = require("../../lib/logger");

module.exports = {
	name: "generateSlashFromText",
	description: "Auto-generate slash command definitions from text commands",
	prerequisites: ["loadTextCommands"],
	execute(client) {
		const log = getLogger("Startup");
		const result = autoGenerateSlashData(client);
		log.info(
			`✅ Slash data generated from text commands: ${result.count} commands`,
		);
	},
};
