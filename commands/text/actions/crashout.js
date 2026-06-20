const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "eb1f965d-51e0-4623-bc73-b60f39fa86c9",
	name: "crashout",
	description: "sends a crashout gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


