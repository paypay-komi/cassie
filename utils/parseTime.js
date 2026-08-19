/**
 * Parses a time string like "10s", "5m", "2h", "1d",
 * "10h 30m", or "1/5h" into milliseconds.
 * @param {string} time - The time string to parse.
 * @returns {number|null} The time in milliseconds, or null if the format is invalid.
 */
function parseTime(time) {
	const regex = /(\d+(?:\.\d+)?|\d+\/\d+)\s*([smhd])/gi;
	const matches = [...time.matchAll(regex)];

	if (!matches.length) return null;

	// Make sure the entire input was consumed
	const normalized = time.replace(/\s+/g, "");
	const matchedText = matches
		.map((match) => match[0].replace(/\s+/g, ""))
		.join("");

	if (normalized !== matchedText) return null;

	let total = 0;

	for (const match of matches) {
		const valueString = match[1];
		const unit = match[2].toLowerCase();

		let value;

		if (valueString.includes("/")) {
			const [numerator, denominator] = valueString.split("/").map(Number);

			if (denominator === 0) return null;

			value = numerator / denominator;
		} else {
			value = Number(valueString);
		}

		let multiplier;

		switch (unit) {
			case "s":
				multiplier = 1000;
				break;
			case "m":
				multiplier = 60 * 1000;
				break;
			case "h":
				multiplier = 60 * 60 * 1000;
				break;
			case "d":
				multiplier = 24 * 60 * 60 * 1000;
				break;
			default:
				return null;
		}

		total += value * multiplier;
	}

	return total;
}

module.exports = parseTime;
