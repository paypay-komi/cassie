const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { getLogger } = require("../../../../lib/logger");

module.exports = {

commandId: "ae45368b-a68e-40fb-af15-68df92c982d2",
	name: "image",
	description: "Sends a random bunny image",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.EmbedLinks],
	parent: "bunny",
	async execute(message, args) {
		const log = getLogger("BunnyImg");
		let jsonData;

		try {
			const res = await fetch(
				"https://rabbit-api-two.vercel.app/api/random",
			);
			jsonData = await res.json();
		} catch (err) {
			log.error("Error fetching bunny image:", err);
			return message.reply(
				"Sorry, I could not fetch a bunny image at this time.",
			);
		}

		if (!jsonData?.url) {
			return message.reply("The bunny API returned invalid data 😢");
		}

		const embed = new EmbedBuilder()
			.setTitle("🐰 Here is a random bunny image for you!")
			.setImage(jsonData.url)
			.setFooter({
				text: jsonData.breed
					? `This rabbit’s breed is ${jsonData.breed}`
					: "Breed unknown",
			})
			.setColor(0xffc0cb);

		return message.reply({ embeds: [embed] });
	},
};
