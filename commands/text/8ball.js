const { EmbedBuilder } = require("discord.js");

const answers = [
	// Positive
	"It is certain.",
	"Without a doubt.",
	"Yes, definitely.",
	"It seems likely.",
	"Sure, why not.",
	// Neutral
	"Try again later.",
	"I don't know.",
	"Hard to say.",
	"Ask your mother.",
	"Ask your father",
	// Negative
	"No.",
	"Don't count on it.",
	"I'm not telling you.",
	"Why are you asking me?",
	"Outlook not so good.",
];

module.exports = {
	name: "8ball",
	description: "Ask the magic 8-ball a question",
	execute(message, args) {
		const question = args.join(" ");

		if (!question) {
			return message.reply(
				"You need to ask a question! `c.8ball <question>`",
			);
		}

		const answer = answers[Math.floor(Math.random() * answers.length)];

		const embed = new EmbedBuilder()
			.setTitle("🎱 Magic 8-Ball")
			.addFields(
				{ name: "Question", value: question },
				{ name: "Answer", value: answer },
			)
			.setColor(0x000000);

		return message.reply({ embeds: [embed] });
	},
};
