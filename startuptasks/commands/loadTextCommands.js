module.exports = {
	name: "loadTextCommands",
	description: "Load text commands on startup",
	execute(client) {
		const textCommandsReloaded = require("../utils/reloadTextcommands")(
			client,
		);
		console.log(
			`✅ Text commands loaded on startup: ${textCommandsReloaded}`,
		);
	},
};
