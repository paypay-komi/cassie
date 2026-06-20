const { PermissionsBitField } = require("discord.js");
const { handleActionCommand } = require("../../../utils/actionCommandHandler");

module.exports = {

commandId: "b573bca9-aca1-4b3f-9b49-a47fa6c4c821",
	name: "sweat",
	description: "sends a sweat gif",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	selfOnly: true,
	selfText: "{author} sweats\n{url}",
	execute(message, args) {
		return handleActionCommand(message, args, this);
	},
};


