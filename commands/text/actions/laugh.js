const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "2c3cce06-a22c-4fb0-bb17-b1b88f295a9c",
	name: "laugh",
	description: "sends a laugh gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} laughs\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


