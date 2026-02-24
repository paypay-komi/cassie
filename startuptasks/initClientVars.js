const { Collection } = require('discord.js');
const config = require('../config.json');
module.exports = {
	name: 'initClientVars',
	description: 'Initialize client variables on startup',
	reloadAble: true, // some times we might want to reset these without restarting the bot
	execute(client) {
		client.owners = config.owners || [];
		client.slashCommands = new Collection();
		client.textCommands = new Collection();
		client.subcommandMap = {}; // parent → { subName → command }
		client.commandSettings = {}; // future per-channel/role/user overrides
		client.prefix = config.prefix;
		console.log('✅ Client variables initialized on startup');
	},
};
