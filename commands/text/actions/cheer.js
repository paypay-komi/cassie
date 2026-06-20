const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "6737deac-3990-41cd-8129-9978a9f5b554",
	name: "cheer",
	description: "sends a cheer gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} cheers\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


