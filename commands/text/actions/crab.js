const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "707aefce-bb01-4e67-90e2-a622b5da62eb",
	name: "crab",
	description: "sends a crab gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} crabs\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


