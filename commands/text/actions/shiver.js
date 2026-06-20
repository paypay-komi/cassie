const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "764fb42d-b4da-4d15-8fe9-6e8283782f94",
	name: "shiver",
	description: "sends a shiver gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} shivers\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


