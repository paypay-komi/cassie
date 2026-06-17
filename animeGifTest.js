// animeGif.js

const API_KEY = "YOUR_TENOR_API_KEY";

/**
 * Get a random anime-style GIF URL for a given action
 * @param {string} query - e.g. "cry", "headbang", "bite"
 * @returns {Promise<string|null>} GIF URL or null
 */
async function getAnimeGif(query) {
	try {
		const q = `anime ${query}`;

		const url =
			`https://tenor.googleapis.com/v2/search` +
			`?q=${encodeURIComponent(q)}` +
			`&key=${API_KEY}` +
			`&limit=20&media_filter=minimal`;

		const res = await fetch(url);
		const data = await res.json();

		if (!data.results || data.results.length === 0) {
			return null;
		}

		// pick random result
		const pick =
			data.results[Math.floor(Math.random() * data.results.length)];

		return pick?.media_formats?.gif?.url || null;
	} catch (err) {
		console.error("GIF fetch error:", err);
		return null;
	}
}

// CLI usage support
(async () => {
	const input = process.argv[2];

	if (!input) {
		console.log("Usage: node animeGif.js <action>");
		process.exit(1);
	}

	const gif = await getAnimeGif(input);
	console.log(gif || "No GIF found");
})();
