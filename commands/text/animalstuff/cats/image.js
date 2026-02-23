module.exports = {
	name: "image",
	description: "Sends a random cat image",
	parent: "cat",
	async execute(message, args) {
		const fetch = require("node-fetch");
		const response = await fetch(
			"https://api.thecatapi.com/v1/images/search",
		);
		const data = await response.json();
		if (!data || !data[0] || !data[0].url) {
			return message.reply(
				"Sorry, I could not fetch a cat image at this time.",
			);
		}
		const { EmbedBuilder } = require("discord.js");
		const embed = new EmbedBuilder()
			.setTitle("🐱 Here is a random cat image for you!")
			.setImage(data[0].url)
			.setColor(0xffa500);
		return message.reply({ embeds: [embed] });
	},
};
