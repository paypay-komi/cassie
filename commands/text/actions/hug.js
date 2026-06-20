const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "f91ffd2b-22c4-492a-8449-31e9c2dcad96",
	name: "hug",
	description: "sends a hug gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	requiresTarget: true,
	parent: "action",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


