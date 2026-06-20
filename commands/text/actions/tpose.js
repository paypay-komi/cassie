const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "3a7f7bbb-9477-4695-a06f-6c451a255a1b",
	name: "tpose",
	description: "sends a tpose gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} TPoses\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


