const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "62d4fb2a-6aea-469d-9d1d-3d740b780e52",
	name: "scream",
	description: "sends a scream gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} screams\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


