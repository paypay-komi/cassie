const { PermissionsBitField } = require("discord.js");

module.exports = {

commandId: "f9dc2550-226b-4698-a322-8c66c1f7e261",
	name: "action",
	description: "action router",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
};
