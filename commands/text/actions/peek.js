const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "fa294f53-9abb-4614-9fdd-2012c2c6b7c5",
	name: "peek",
	description: "sends a peek gif",
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


