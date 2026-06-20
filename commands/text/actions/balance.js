const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "0f005682-b628-48b0-a2cb-4c0c5b8ec841",
	name: "balance",
	description: "sends a balance gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} balances\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


