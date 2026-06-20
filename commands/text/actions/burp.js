const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "d1ec3f12-49c4-4e53-8e7f-7dc063449813",
	name: "burp",
	description: "sends a burp gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} burps\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


