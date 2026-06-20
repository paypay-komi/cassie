const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "53026be3-79bb-4894-a763-b59a8eb57541",
	name: "kiss",
	description: "sends a kiss gif",
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


