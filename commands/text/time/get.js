const { description } = require("./set");
const { Message } = require("discord.js");
const db = require("../../../db/boobs.js");
const { time } = require("node:console");
module.exports = {
	name: "get",
	parent: "time",
	description: "gets the time from a mentioned user",
	/**
	 *
	 * @param {Message} message
	 * @param {*} args
	 */
	async execute(message, args) {
		if (!message.mentions.users.first()) {
			return message.reply(
				"you must mention a user to get their time silly ",
			);
		}
		const time_zone_data = await db.prisma.userTimezone.findUnique({
			where: { userId: message.mentions.users.first().id },
		});
		if (!time_zone_data)
			return message.reply(
				"this user has not set their timezone ask them to run c.time set",
			);
		message.reply(JSON.stringify(time_zone_data, null, 2));
	},
};
