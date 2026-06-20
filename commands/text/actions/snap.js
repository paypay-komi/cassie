const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "84e24592-2a79-4f2e-b3fd-0329e5d2f98c",
	name: "snap",
	description: "sends a snap gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


