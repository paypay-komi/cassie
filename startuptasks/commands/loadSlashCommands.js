const { getLogger } = require("../../lib/logger");

module.exports = {
	name: 'loadSlashCommands',
	description: 'Load slash commands on startup',
	execute(client) {
		const log = getLogger("LoadSlashCmds");
		const reloadSlashcommands = require('../../utils/reloadSlashcommands');
		const slashCommandsReloaded = reloadSlashcommands(client);
		log.info(
			`✅ Slash commands loaded on startup: ${slashCommandsReloaded}`,
		);
	},
};
