const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "d70bac12-88cf-4455-b318-0f7ca8ab6b17",
	name: "somersault",
	description: "sends a somersault gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} does a somersault\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


