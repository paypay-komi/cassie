const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "a8e36e0f-2d2a-4f4f-8296-2fc590512473",
	name: "shuffle",
	description: "sends a shuffle gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} shuffles\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


