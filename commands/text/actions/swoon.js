const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "be892450-084a-4628-bfd7-59e1f58039a1",
	name: "swoon",
	description: "sends a swoon gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} swoons\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


