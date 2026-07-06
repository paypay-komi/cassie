const { PermissionsBitField } = require("discord.js");

module.exports = {
	commandId: "05899a1f-29e4-414b-b3b8-f7f49cfe9241",
	name: "userInfo",
	description: "gets various userinfo on a user",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	aliases: ["useri", "ui", "personInfo"],
	dmUse: false,
	/**
	 * @param {import("discord.js").Message<true>} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		let target = message.member;
		if (args.length > 1)
			return message.reply(
				" only one arg is allowed for this cmd \n if you want to see user info on a specifc user you must ping them",
			);
		if (args.length > 0) {
			target = message.mentions.members.first(); // should have been a mentioned member if there is an arg
		}
		if (!target)
			return message.reply(
				"Sorry!!! I could not find that member (you have to ping them ):c",
			);
		const displayName = target.displayName;
		message.reply(displayName+ ("\n-# this cmd is a wip :c. I'm too sleepy right now to finish it....."));
	},
};
