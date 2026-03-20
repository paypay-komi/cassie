const Discord = require("discord.js");
module.exports = {
	name: "set",
	description: "sets your time zone following a simple flow",
	parent: "time",
	/**
	 *
	 * @param {Discord.Message} message
	 * @param {String[]} args
	 *
	 */
	async execute(message, args) {
		if (args.length == 0) {
			return await message.reply(
				"please include your current time either in 24H time or 12H time",
			);
		}
		const joinedArgs = args.join(" ").trim();
		const regex12Hour = /^(0?[1-9]|1[0-2]):([0-5]\d) *([ap]m)$/im;
		const regex24Hour = /^([01]\d|2[0-3])([0-5]\d)$/im;
		const match12Hour = joinedArgs.match(regex12Hour);
		const match24Hour = joinedArgs.match(regex24Hour);
		if (!match12Hour && !match24Hour)
			return await message.reply(
				"no valid time found if using 12 hour time use hh:mm (am/pm) and dont use a colon for 24 hour time",
			);

		const currentTime = new Date();
		const currentHours = currentTime.getHours();
		const currentMin = currentTime.getMinutes();
		let usersCurrentHour = NaN;
		if (match12Hour) {
			let hour = parseInt(match12Hour[1], 10);
			const period = match12Hour[3].toLowerCase();

			if (period === "am") {
				usersCurrentHour = hour === 12 ? 0 : hour; // 12 AM → 0
			} else {
				// pm
				usersCurrentHour = hour === 12 ? 12 : hour + 12; // 12 PM → 12
			}
		}

		if (match24Hour) {
			usersCurrentHour = parseInt(match24Hour[1], 10);
		}
		const offSet = 0 - (currentHours - usersCurrentHour);
	},
};
