const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "42daa7be-62f6-4805-a99b-99ec8877aec1",
	name: "tackle",
	description: "sends a tackle gif",
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


