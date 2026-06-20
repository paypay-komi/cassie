const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "2ef7d3cd-aa2a-483a-86f3-d428312b2ed1",
	name: "magic",
	description: "sends a magic gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} does magic\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


