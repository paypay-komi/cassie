const { getLogger } = require("../../lib/logger");

module.exports = {
	name: "loadTextCommands",
	description: "Load text commands on startup",
	execute(client) {
		const log = getLogger("LoadTextCmds");
		const reloadTextcommands = require("../../startup-lib/reloadTextcommands");
		const result = reloadTextcommands(client);
		log.info(
			`✅ Text commands loaded on startup: ${result.reloaded} (${result.subcommands} subcommands, ${result.failed.length} failed)`,
		);
	},
};
