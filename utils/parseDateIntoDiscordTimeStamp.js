const discordTimeStampFormats = {
	ShortTime: 't', // 16:20
	LongTime: 'T', // 16:20:30
	ShortDate: 'd', // 20/04/2024
	LongDate: 'D', // 20 April 2024
	ShortDateTime: 'f', // 20 April 2024 16:20
	LongDateTime: 'F', // Saturday, 20 April 2024 16:20
	RelativeTime: 'R' // in 2 minutes
};
/**
 * Converts a Date object or a timestamp in milliseconds into a Discord timestamp string.
 * @param {Date|number} date - The date to convert, either as a Date object or a timestamp in milliseconds.
 * @param {string} format - The desired Discord timestamp format (default is 'R' for relative time).
 * @returns {string} The formatted Discord timestamp string.
 * @throws {Error} If the format is invalid or if the date is not a valid Date object or timestamp.
 */

function parseDateIntoDiscordTimeStamp(date, format = 'R') {
	if (!discordTimeStampFormats[format] && !Object.values(discordTimeStampFormats).includes(format)) {
		throw new Error(`Invalid format. Valid formats are: ${Object.keys(discordTimeStampFormats).join(', ')}`);
	}
	if (date instanceof Date) {
		return `<t:${Math.floor(date.getTime() / 1000)}:${format}>`;
	} else if (typeof date === 'number') {
		return `<t:${Math.floor(date / 1000)}:${format}>`;
	} else {
		throw new Error('Invalid date format. Must be a Date object or a timestamp in milliseconds.');
	}
}
module.exports =  {parseDateIntoDiscordTimeStamp, discordTimeStampFormats};
