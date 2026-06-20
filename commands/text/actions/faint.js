const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "bb6b8e68-dbea-4546-ad7a-4df418adb28e",
	name: "faint",
	description: "sends a faint gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} faints\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


