const { getLogger } = require("../../lib/logger");

module.exports = {
	name: "loadTextCommands",
	description: "Load text commands on startup",
	execute(client) {
		const log = getLogger("LoadTextCmds");
		const textCommandsReloaded = require("../../utils/reloadTextcommands")(
			client,
		);
		log.info(
			`✅ Text commands loaded on startup: ${textCommandsReloaded}`,
		);
	},
};
