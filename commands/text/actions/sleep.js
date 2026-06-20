const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "a1115503-e5af-4bd8-a658-e80d8c743967",
	name: "sleep",
	description: "sends a sleep gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} sleeps\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


