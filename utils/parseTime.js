/**
 * Parses a time string like "10s", "5m", "2h", or "1d" into milliseconds.
 * @param {string} time - The time string to parse.
 * @returns {number|null} The time in milliseconds, or null if the format is invalid.
 */
function parseTime(time) {
	const match = time.match(/^(\d+)([smhd])$/);
	if (!match) return null;
	const value = parseInt(match[1], 10);
const unit = match[2].toLocaleLowerCase();
	let multiplier;
	switch (unit) {
		case 's':
			multiplier = 1000;
			break;
		case 'm':
			multiplier = 60 * 1000;
			break;
		case 'h':
			multiplier = 60 * 60 * 1000;
			break;
		case 'd':
			multiplier = 24 * 60 * 60 * 1000;
			break;
		default:
			return null;
	}
	return value * multiplier;
}

module.exports = parseTime;
