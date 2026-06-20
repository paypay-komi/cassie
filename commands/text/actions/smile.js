const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "aedf7da8-4a3b-49fe-a757-2199b568fc76",
	name: "smile",
	description: "sends a smile gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} smiles\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


