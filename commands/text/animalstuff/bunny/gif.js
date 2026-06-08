const { PermissionsBitField, EmbedBuilder } = require("discord.js");

module.exports = {

commandId: "803d476b-c564-46f8-824a-7d983dd5ba9d",
	name: "gif",
	description: "Sends a random bunny gif",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.EmbedLinks],
	parent: "bunny",
	async execute(message, args) {
		const fetch = require("node-fetch");
		const response = await fetch(
			"https://api.bunnies.io/v2/loop/random/?media=gif",
		);
		const data = await response.json();
		if (!data || !data.media || !data.media.gif) {
			return message.reply(
				"Sorry, I could not fetch a bunny gif at this time.",
			);
		}
		const embed = new EmbedBuilder()
			.setTitle("🐰 Here is a random bunny gif for you!")
			.setImage(data.media.gif)
			.setFooter({ text: `this bunny source is ${data.source}` })
			.setColor(0xffc0cb);
		return message.reply({ embeds: [embed] });
	},
};
