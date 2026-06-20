const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "2d9af175-a349-4e47-a8f7-27b14b507a15",
	name: "blush",
	description: "sends a blush gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} blushes\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


