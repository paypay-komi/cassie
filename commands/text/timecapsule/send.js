const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../../lib/logger");
const { ArgsBuilder } = require("../../../lib/argsBuilder");
const parseTime = require("../../../utils/parseTime.js");
const setupTimeCapsuleTask = require("../../../startuptasks/data/startUpTimeCapsuleTask");
const {
	parseDateIntoDiscordTimeStamp,
	discordTimeStampFormats,
} = require("../../../utils/parseDateIntoDiscordTimeStamp.js");

module.exports = {
	commandId: "e187e953-dbfd-4c86-a71c-5c8050c34331",
	name: "send",
	description: "Send a message to your future self",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	aliases: ["create", "add", "schedule"],
	parent: "timecapsule",
	args: ArgsBuilder.create()
		.string("time", { required: true, description: "When to send (e.g. 10m, 2h, 1d)" })
		.string("message", { required: true, description: "Message to your future self" }),

	async execute(message, args) {
		const log = getLogger("TimeCapsule");
		const time = args[0];
		const content = args.slice(1).join(" ");

		if (!time || !content) {
			return message.reply(
				"Usage: `c.timecapsule send <time> <message>`\nExample: `c.timecapsule send 7d Hey future me, hope you're doing great!`",
			);
		}

		const offset = parseTime(time);
		if (!offset) {
			return message.reply(
				"Invalid time format. Use formats like `10m`, `2h`, or `7d`.",
			);
		}

		const sendAt = new Date(Date.now() + offset);
		const discordTimestamp = parseDateIntoDiscordTimeStamp(
			sendAt,
			discordTimeStampFormats.ShortDateTime,
		);

		try {
			await message.client.db.prisma.timeCapsule.create({
				data: {
					userId: message.author.id,
					content,
					sendAt,
				},
			});

			await message.reply(
				`📦 Time capsule set! I'll deliver **"${content}"** to you on ${discordTimestamp}.\n\n*Check your DMs then!*`,
			);

			setupTimeCapsuleTask.recheck(message.client);
		} catch (err) {
			log.error("Error creating time capsule:", err);
			await message.reply("Failed to create time capsule. Please try again later.");
		}
	},
};
