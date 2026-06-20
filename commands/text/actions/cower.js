const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "33bb0c31-937e-4932-8a8e-a0ae47a141f3",
	name: "cower",
	description: "sends a cower gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} cowers\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


