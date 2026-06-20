const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "86a3b0b7-b26d-40dc-8643-d4a6d8de3e74",
	name: "gasp",
	description: "sends a gasp gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} gasps\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


