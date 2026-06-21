const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "9de62451-c5bb-41fc-807e-e71cf69f405b",
	name: "eat",
	description: "sends an eat gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	requiresTarget: false,
	parent: "action",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};

