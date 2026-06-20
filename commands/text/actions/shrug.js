const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "d270309f-5dbe-4e62-b46a-28a8375c6c5e",
	name: "shrug",
	description: "sends a shrug gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} shrugs\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


