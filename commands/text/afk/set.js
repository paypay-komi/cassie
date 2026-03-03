const db = require("../../../db/boobs.js");
module.exports = {
	name: "set",
	description: "sets your afk optional message arg",
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
		await message.reply("afk status is upserteddddd YIPEEEEEEE");
	},
};
