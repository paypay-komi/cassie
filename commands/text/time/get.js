const {
	PermissionsBitField,
	Message,
	TextDisplayBuilder,
	MessageFlags,
	ContainerBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
} = require("discord.js");
const db = require("../../../db/boobs.js");
const { DateTime } = require("luxon");
module.exports = {
	name: "get",
	parent: "time",
	description: "gets the time from a mentioned user",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
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
		if (other_persons_time_zone_data.timeZoneString !== "NONE") {
			timezone = other_persons_time_zone_data.timeZoneString;
		} else {
			const offsetMinutes = other_persons_time_zone_data.minsOffset;

			const sign = offsetMinutes >= 0 ? "+" : "-";
			const absMinutes = Math.abs(offsetMinutes);

			const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
			const minutes = String(absMinutes % 60).padStart(2, "0");

			timezone = `UTC${sign}${hours}:${minutes}`;
		}
		const dt = DateTime.now().setZone(timezone);
		const user = message.mentions.users.first();

		const title = new TextDisplayBuilder().setContent(
			`# 🕒 ${user.displayName}'s Time`,
		);

		const body = new TextDisplayBuilder().setContent(
			[
				`## ${dt.toFormat("h:mm a")}`,
				`### ${dt.toFormat("cccc, LLLL d")}`,
				"",
				`- 🌍 ${timezone}`,
				`- ☀️ DST: ${dt.isInDST ? "Yes" : "No"}`,
			].join("\n"),
		);

		const separator = new SeparatorBuilder().setSpacing(
			SeparatorSpacingSize.Small,
		);

		const container = new ContainerBuilder()
			.addTextDisplayComponents(title)
			.addSeparatorComponents(separator)
			.addTextDisplayComponents(body);

		message.reply({
			components: [container],
			flags: MessagePermissionsBitField.Flags.IsComponentsV2,
		});
	},
};
