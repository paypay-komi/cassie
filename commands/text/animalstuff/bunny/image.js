const { EmbedBuilder } = require('discord.js');

module.exports = {
	name: 'image',
	description: 'Sends a random bunny image',
	parent: 'bunny',
	async execute(message, args) {
		let jsonData;

		try {
			const res = await fetch(
				'https://rabbit-api-two.vercel.app/api/random',
			);
			jsonData = await res.json();
		} catch (err) {
			console.error('Error fetching bunny image:', err);
			return message.reply(
				'Sorry, I could not fetch a bunny image at this time.',
			);
		}

		if (!jsonData?.url) {
			return message.reply('The bunny API returned invalid data 😢');
		}

		const embed = new EmbedBuilder()
			.setTitle('🐰 Here is a random bunny image for you!')
			.setImage(jsonData.url)
			.setFooter({
				text: jsonData.breed
					? `This rabbit’s breed is ${jsonData.breed}`
					: 'Breed unknown',
			})
			.setColor(0xffc0cb);

		return message.reply({ embeds: [embed] });
	},
};
