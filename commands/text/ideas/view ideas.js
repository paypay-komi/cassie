const db = require("../../../db/boobs.js");
const { execute } = require("./add idea.js");
module.exports = {
	name: "view",
	parent: "idea",
	/**
	 * @param {import("discord.js").Message} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		const ideas = await db.prisma.idea.findMany({
			where: { status: "approved" },
		});
		for (const idea of ideas) {
			message.reply(
				`${idea.content} by ${(await message.client.users.fetch(idea.authorId)).displayName}`,
			);
		}
	},
};
