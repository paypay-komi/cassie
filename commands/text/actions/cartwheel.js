const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "b60f396a-0997-41de-902a-10e4f670d8a0",
	name: "cartwheel",
	description: "sends a cartwheel gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} does a cartwheel\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


