const { Message } = require("discord.js");
const db = require("../../../db/boobs.js");
const { DateTime } = require("luxon");
const { time } = require("node:console");
module.exports = {
	name: "get",
	parent: "time",
	description: "gets the time from a mentioned user",
	/**
	 *
	 * @param {Message} message
	 * @param {String[]} args
	 */
	async execute(message, args) {
		if (!message.mentions.users.first()) {
			return message.reply(
				"you must mention a user to get their time silly ",
			);
		}
		const other_persons_time_zone_data =
			await db.prisma.userTimezone.findUnique({
				where: { userId: message.mentions.users.first().id },
			});
		if (!other_persons_time_zone_data)
			return message.reply(
				`${message.mentions.users.first().displayName} has not set their timezone ask them to run c.time set`,
			);
		let timezone;
		if (other_persons_time_zone_data.timeZoneString)
			timezone = other_persons_time_zone_data.timeZoneString;
		else
			timezone = `UTC${Math.round(other_persons_time_zone_data.minsOffset / 60)}`;
		const dt = DateTime.now().setZone(timezone);
		message.reply(
			`other persons time: \n ${dt.toFormat("hh:mm")}\n dst: ${dt.isInDST}`,
		);
	},
};
