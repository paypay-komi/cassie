const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "39ed21dd-1ce3-4793-9ec6-f91b497e8d7c",
	name: "choke",
	description: "sends a choke gif",
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


