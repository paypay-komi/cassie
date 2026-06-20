const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "26d499a9-bfd9-4916-bc00-f3034a7d2cf8",
	name: "backflip",
	description: "sends a backflip gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} backflips\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


