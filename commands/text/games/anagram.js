const { PermissionsBitField } = require("discord.js");
const { WORDS, randomWord } = require("../../../utils/words");
const { shuffle } = require("../../../utils/shuffle");

const WORD_SET = new Set(WORDS.map(w => w.toLowerCase()));

function signature(word) {
  return word.toLowerCase().split("").sort().join("");
}

function findAnagrams(word) {
  const sig = signature(word);
  const results = [];
  for (const w of WORDS) {
    if (w !== word && signature(w) === sig) results.push(w);
  }
  return results;
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
  async execute(message, args) {
    const word = randomWord();
    const anagrams = findAnagrams(word);
    const validAnswers = new Set([word, ...anagrams].map(w => w.toLowerCase()));

    let scrambled = shuffle(word.split("")).join("");
    while(scrambled === word && word.length > 2) {
      scrambled = shuffle(word.split("")).join("");
    }

    const reply = await message.channel.send(
      `**Anagram!** Unscramble these letters:\n\n` +
      `\`${scrambled.toUpperCase()}\`\n\n` +
      `Type your guess in chat!`
    );

    const collector = message.channel.createMessageCollector({
      filter: m => !m.author.bot,
      time: 45000,
    });

    collector.on("collect", m => {
      const guess = m.content.toLowerCase().trim();
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
