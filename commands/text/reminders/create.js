const parseTime = require("../../../utils/parseTime.js");
const {
	parseDateIntoDiscordTimeStamp,
	discordTimeStampFormats,
} = require("../../../utils/parseDateIntoDiscordTimeStamp.js");
module.exports = {
	name: "create",
	description: "Create a reminder",
	aliases: ["add", "new", "set"],
	parent: "reminders",
	async execute(message, args) {
		const userId = message.author.id;
		const content = args.slice(0, -1).join(" ");
		const time = args[args.length - 1];
		if (!content || !time) {
			return message.reply(
				"Please provide both reminder content and time. Example: `c.reminders create Buy milk in 10m`",
			);
		}
		const reminderTime = parseTime(time);
		if (!reminderTime) {
			return message.reply(
				"Invalid time format. Please use formats like `10m`, `2h`, or `1d`.",
			);
		}
		const reminderDate = new Date(Date.now() + reminderTime);
		const discordTimestamp = parseDateIntoDiscordTimeStamp(
			reminderDate,
			discordTimeStampFormats.ShortDateTime,
		);
		message.client.db.prisma.reminder
			.create({
				data: {
					userId,
					content,
					createdAt: new Date(),
					remindAt: reminderDate,
				},
			})
			.then(() => {
				message.reply(
					`Reminder set for "${content}" at ${discordTimestamp}`,
				);
			})
			.catch((error) => {
				console.error("Error creating reminder:", error);
				message.reply(
					"Failed to create the reminder. Please try again later.",
				);
			});
	},
};
