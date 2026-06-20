const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "749b6e33-1130-46e2-af65-bc2c8bf55fcd",
	name: "tea",
	description: "sends a tea gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} drinks tea\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


