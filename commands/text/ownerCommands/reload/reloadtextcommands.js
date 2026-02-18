const { parser } = require("typescript-eslint");
const reloadTextCommands = require("../../../../utils/reloadTextcommands");
module.exports = {
	name: "text",
	description: "Reload text commands",
	permissions: ["botOwner"],
	parent: "reload",
	async execute(message, args) {
		const textCommandsReloaded = reloadTextCommands(message.client);
		await message.reply(
			`✅ Text commands reloaded! ${JSON.stringify(textCommandsReloaded, null, 2)}`,
		);
	},
};
