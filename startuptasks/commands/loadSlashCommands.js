module.exports = {
	name: 'loadSlashCommands',
	description: 'Load slash commands on startup',
	execute(client) {
		const reloadSlashcommands = require('../../utils/reloadSlashcommands');
		const slashCommandsReloaded = reloadSlashcommands(client);
		console.log(
			`✅ Slash commands loaded on startup: ${slashCommandsReloaded}`,
		);
	},
};
