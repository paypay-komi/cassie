const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "81f26c13-5d56-4c98-9779-fc832727946d",
	name: "grin",
	description: "sends a grin gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} grins\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


