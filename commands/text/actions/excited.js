const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "9e6aa4a7-e060-4c13-9446-55b9c0596c94",
	name: "excited",
	description: "sends a excited gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} is excited\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


