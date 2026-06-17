const { PermissionsBitField } = require("discord.js");

module.exports = {
	name: "action",
	description: "action router",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
};
