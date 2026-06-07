const config = require("../../config.json");
const { Collection } = require("discord.js");
const { getLogger } = require("../../lib/logger");
module.exports = {
	name: "initClientVars",
	description: "Initialize client variables on startup",
	reloadAble: true, // some times we might want to reset these without restarting the bot
	priority: 1000000000,
	execute(client) {
		const log = getLogger("InitClient");
		client.owners = config.owners || [];
		client.slashCommands = new Collection();
		client.textCommands = new Collection();
		client.subcommandMap = {}; // parent → { subName → command }
		client.commandSettings = {}; // future per-channel/role/user overrides
		client.afk = new Map();
		log.info("✅ Client variables initialized on startup");
	},
};
