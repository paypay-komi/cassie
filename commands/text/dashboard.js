const { PermissionsBitField, MessageType } = require("discord.js");

module.exports = {

commandId: "372a9454-995f-4234-8d51-569e405b1eb3",
	name: "website",
	description: "posts a link for the dashboard of the bot ",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	aliases: ["config", "dashboard", "landing"],
	/**
	 * @param {import("discord.js").Message} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		message.reply("https://nekomi.tailef6033.ts.net");
	},
};
