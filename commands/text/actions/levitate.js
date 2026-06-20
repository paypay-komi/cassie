const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "cac305b8-22d1-4629-a8e3-b1ded9deeedc",
	name: "levitate",
	description: "sends a levitate gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} levitates\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


