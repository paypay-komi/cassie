module.exports = {
	name: "loadTextCommands",
	description: "Load text commands on startup",
	reloadAble: true,
	execute(client) {
		const textCommandsReloaded = require("../utils/reloadTextcommands")(
			client,
		);
		console.log(
			`✅ Text commands loaded on startup: ${textCommandsReloaded}`,
		);
	},
};
