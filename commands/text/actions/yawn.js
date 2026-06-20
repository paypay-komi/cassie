const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "28e0a935-2987-4064-967e-ba9541d4007b",
	name: "yawn",
	description: "sends a yawn gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} yawns\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


