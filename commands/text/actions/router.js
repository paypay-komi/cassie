const { PermissionsBitField } = require("discord.js");

module.exports = {
	commandId: "f9dc2550-226b-4698-a322-8c66c1f7e261",
	name: "action",
	description: "Send animated action GIFs to other users.",
	category: {
		name: "Fun",
		emoji: "🎉",
		description: "Fun commands, actions, and entertainment.",
		order: 40,
	},
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
};
