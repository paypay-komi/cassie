const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "2ed1cdac-b8f8-4b25-977e-b1ac3565338c",
	name: "cry",
	description: "sends a cry gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} cries\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


