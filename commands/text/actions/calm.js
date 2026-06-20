const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "edc7d98b-f90f-4981-84eb-bdb2c647a166",
	name: "calm",
	description: "sends a calm gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} is calm\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


