const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "3b5d6b23-3ac2-4d57-aed7-1db75baa0c92",
	name: "happy",
	description: "sends a happy gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} is happy\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


