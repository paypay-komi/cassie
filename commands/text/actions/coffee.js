const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "c020899d-ba35-4df3-ac49-4d6b873b1649",
	name: "coffee",
	description: "sends a coffee gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} drinks coffee\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


