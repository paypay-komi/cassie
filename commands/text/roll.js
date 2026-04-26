const { EmbedBuilder, AttachmentBuilder } = require("discord.js");

const MAX_DICE = 100000;
const MAX_SIDES = 1000000;
const SHOW_ROLLS_LIMIT = 50;

module.exports = {
	name: "roll",
	description: "Roll dice. Usage: c.roll [NdN] e.g. c.roll 2d6",
	execute(message, args) {
		if (!args[0])
			return message.reply(
				"Usage: `c.roll [NdN]` e.g. `c.roll 2d6` or `c.roll 20`",
			);

		const parts = args[0].toLowerCase().split("d");
		let amount, sides;

		if (parts.length === 2) {
			amount = Number(parts[0]) || 1;
			sides = Number(parts[1]);
		} else if (parts.length === 1) {
			amount = 1;
			sides = Number(parts[0]);
		} else {
			return message.reply(
				"Invalid format. Try `c.roll 2d6` or `c.roll 20`",
			);
		}

		if (isNaN(sides) || sides < 2)
			return message.reply("Sides must be a number 2 or greater.");
		if (isNaN(amount) || amount < 1)
			return message.reply("Number of dice must be 1 or more.");
		if (amount > MAX_DICE)
			return message.reply(`Max ${MAX_DICE} dice at once.`);
		if (sides > MAX_SIDES) return message.reply(`Max ${MAX_SIDES} sides.`);

		const rolls = [];
		for (let i = 0; i < amount; i++) {
			rolls.push(Math.floor(Math.random() * sides) + 1);
		}

		const sum = rolls.reduce((a, b) => a + b, 0);
		const avg = (sum / amount).toFixed(2);

		const embed = new EmbedBuilder()
			.setTitle(`🎲 ${amount}d${sides}`)
			.addFields(
				{ name: "Sum", value: String(sum), inline: true },
				{ name: "Average", value: String(avg), inline: true },
			)
			.setColor(0x5865f2);

		if (amount <= SHOW_ROLLS_LIMIT) {
			embed.addFields({ name: "Rolls", value: rolls.join(", ") });
			return message.reply({ embeds: [embed] });
		}

		// Too many rolls — attach as a file
		const fileContent = rolls.join("\n");
		const attachment = new AttachmentBuilder(
			Buffer.from(fileContent, "utf-8"),
			{ name: `rolls_${amount}d${sides}.txt` },
		);

		embed.addFields({ name: "Rolls", value: "*(See attached file)*" });
		return message.reply({ embeds: [embed], files: [attachment] });
	},
};
