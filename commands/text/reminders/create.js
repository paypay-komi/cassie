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
		// attempt to dm the user to confirm the reminder, if dm fails, reply in channel but warn about dms being closed
		let dmSuccess = true;

		try {
			await message.author.send(
				`You set a reminder for "${content}" at ${discordTimestamp}. I will remind you in DMs!`,
			);
		} catch (error) {
			console.warn(
				`Could not send DM to user ${message.author.tag} (${message.author.id}). They might have DMs closed.`,
				error,
			);
			await message.reply(
				`You tried to set a reminder for "${content}" at ${time}. I would love to remind you in DMs, but it seems like I can't DM you. Please check your DM settings! instead, I'll reply here when it's time to remind you.`,
			);
		}
		message.client.db.prisma.reminder
			.create({
				data: {
					userId,
					content,
					createdAt: new Date(),
					remindAt: reminderDate,
					remindInChannel: !dmSuccess, // If we can't DM the user, we'll remind them in the channel instead
					channelId: dmSuccess ? null : message.channel.id, // If reminding in channel, save the channel ID
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
