const { PermissionsBitField, MessageType } = require("discord.js");

module.exports = {

commandId: "372a9454-995f-4234-8d51-569e405b1eb3",
	name: "website",
	description: "Post a link to the bot's dashboard.",
	aliases: ["config", "dashboard", "landing"],
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	category: {
		name: "Bot",
		emoji: "🤖",
		description: "Bot information and configuration.",
		order: 10,
	},
	/**
	 * @param {import("discord.js").Message} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		message.reply("https://nekomi.tailef6033.ts.net");
	},
};
