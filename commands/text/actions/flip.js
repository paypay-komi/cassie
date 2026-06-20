const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "f23925b4-00a8-467e-a3cb-2d8573a87f06",
	name: "flip",
	description: "sends a flip gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} flips\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


