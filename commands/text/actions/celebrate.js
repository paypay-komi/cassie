const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "96003710-9708-4195-9e12-f9da34fb78ba",
	name: "celebrate",
	description: "sends a celebrate gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} celebrates\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


