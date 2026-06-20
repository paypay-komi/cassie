const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "13cd2951-bd93-446c-a719-ee9d5b422adf",
	name: "bake",
	description: "sends a bake gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} bakes\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


