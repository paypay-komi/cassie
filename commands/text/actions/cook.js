const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "df9025f5-cb12-49bd-bb3d-25ef6c9ddd13",
	name: "cook",
	description: "sends a cook gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} cooks\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


