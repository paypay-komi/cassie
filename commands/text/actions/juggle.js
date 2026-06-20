const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "53c6e7a4-5649-4d80-9398-cafb5185e97e",
	name: "juggle",
	description: "sends a juggle gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} juggles\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


