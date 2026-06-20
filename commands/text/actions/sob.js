const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "f64884da-9022-476b-9028-ae2eb7e28286",
	name: "sob",
	description: "sends a sob gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} sobs\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


