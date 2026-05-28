const { PermissionsBitField } = require("discord.js");
const db = require("../../../db");
module.exports = {
	name: "set",
	description: "sets your afk optional message arg",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	parent: "afk",
	async execute(message, args) {
		await db.prisma.globalAfkUser.upsert({
			create: {
				userId: message.author.id,
				reason: args.join(" ") || "this user is afk",
			},
			update: {
				userId: message.author.id,
				reason: args.join(" ") || "this user is afk",
			},
			where: {
				userId: message.author.id,
			},
		});
		const db_data = await db.prisma.globalAfkUser.findFirst({
			where: {
				userId: message.author.id,
			},
		});
		message.client.afk.set(message.author.id, db_data);
		await message.reply("afk status is upserteddddd YIPEEEEEEE");
	},
};
