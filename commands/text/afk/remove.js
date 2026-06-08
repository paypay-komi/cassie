const { PermissionsBitField } = require("discord.js");
const db = require("../../../db");
module.exports = {
	commandId: "e0712c98-e91c-4b4c-a873-1bf5e3cff84e",
	name: "remove",
	description: "removes your current afk if you have one",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	parent: "afk",
	async execute(message, args) {
		if (!message.client.afk.has(message.author.id)) {
			return message.reply(
				"You don't have an afk set maybe you forgot to do afk set?",
			);
		}
		await db.prisma.globalAfkUser.delete({
			where: { userId: message.author.id },
		});
		message.client.afk.delete(message.author.id);
		message.reply(
			`your afk has been removed welcome back ${message.author.displayName}`,
		);
	},
};
