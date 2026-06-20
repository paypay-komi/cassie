const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "e0eeacbf-4155-40fd-98b1-2eb6c60a2822",
	name: "relaxed",
	description: "sends a relaxed gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} is relaxed\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


