const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "fb725313-c251-4882-bb71-c51e735d39db",
	name: "moonwalk",
	description: "sends a moonwalk gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} moonwalks\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


