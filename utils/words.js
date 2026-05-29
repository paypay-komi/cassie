const { readFileSync } = require("fs");
const { join } = require("path");

const WORDS = readFileSync(join(__dirname, "..", "words.txt"), "utf8").split("\n");

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function randomWords(count) {
  const result = [];
  for (let i = 0; i < count; i++) result.push(randomWord());
  return result;
}

module.exports = { WORDS, randomWord, randomWords };
