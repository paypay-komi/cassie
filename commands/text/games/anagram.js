const { PermissionsBitField } = require("discord.js");
const { WORDS, randomWord } = require("../../../utils/words");
const { shuffle } = require("../../../utils/shuffle");

function signature(word) {
	return word.toLowerCase().replace(/\s+/g, "").split("").sort().join("");
}

// precompute signature -> words map once at load so findAnagrams is O(1) instead of scanning WORDS every game
// strip ALL whitespace (not just leading/trailing) - some WORDS entries have internal spaces baked in
const SIG_MAP = new Map();
for (const raw of WORDS) {
	const w = raw.replace(/\s+/g, "");
	const sig = signature(w);
	if (!SIG_MAP.has(sig)) SIG_MAP.set(sig, []);
	SIG_MAP.get(sig).push(w);
}

function findAnagrams(word) {
	const sig = signature(word);
	return (SIG_MAP.get(sig) || []).filter((w) => w !== word);
}

module.exports = {
	commandId: "83bbbe59-6e58-4a4f-ba76-2e908a8630be",
	name: "anagram",
	description: "Unscramble the word! Type your guess in chat.",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	parent: "games",
	aliases: [],
	slashEnabled: false,
	async execute(message, args) {
		const word = randomWord().replace(/\s+/g, ""); // strip ALL whitespace, not just leading/trailing - some WORDS entries have internal spaces
		const anagrams = findAnagrams(word);
		const validAnswers = new Set(
			[word, ...anagrams].map((w) => w.toLowerCase()),
		);

		let scrambled = shuffle(word.split("")).join("");
		while (scrambled === word && word.length > 2) {
			scrambled = shuffle(word.split("")).join("");
		}

		const reply = await message.channel.send(
			`**Anagram!** Unscramble these letters:\n\n` +
				`\`${scrambled.toUpperCase()}\`\n\n` +
				`Type your guess in chat!`,
		);

		const collector = message.channel.createMessageCollector({
			filter: (m) => !m.author.bot,
			time: 45000,
		});

		collector.on("collect", (m) => {
			const guess = m.content
				.toLowerCase()
				.trim()
				.replace(/[^a-zA-Z0-9'-]/g, "");
			if (validAnswers.has(guess)) {
				let res = `**${m.author.username}** got it! The word was **${word}**`;
				if (anagrams.length > 0) {
					res += `\nOther answers: ${anagrams.join(", ")}`;
				}
				m.reply(res);
				collector.stop("won");
			}
		});

		collector.on("end", (_, reason) => {
			if (reason !== "won") {
				let res = `Time's up! The word was **${word}**`;
				if (anagrams.length > 0) {
					res += `\nOther answers: ${anagrams.join(", ")}`;
				}
				reply.reply(res);
			}
		});
	},
};
