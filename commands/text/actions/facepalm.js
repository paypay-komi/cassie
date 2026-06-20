const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "a86d8aa0-1f83-4ab0-ae2f-36186dc42241",
	name: "facepalm",
	description: "sends a facepalm gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} facepalms\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


