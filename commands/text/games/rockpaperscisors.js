const {
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	Component,
} = require("discord.js");
module.exports = {
	name: "rockPaperScissors",
	parent: "games",
	aliases: ["rps"],
	async execute(message, args) {
		const game_message = await message.reply("loading...");
		function makeButtons(user) {
			function makeButton(emoji) {
				return new ButtonBuilder()
					.setStyle(ButtonStyle.Primary)
					.setCustomId(`rps-${message.id}-${user.id}-${emoji}`)
					.setLabel(emoji);
			}
			const buttons = [];
			buttons.push(makeButton("🪨"));
			buttons.push(makeButton("📄"));
			buttons.push(makeButton("✂️"));
			return new ActionRowBuilder().addComponents(buttons);
		}
		let is_ai = true;
		let other_player = await message.client.user.fetch();
		if (message.mentions.users.first()) {
			other_player = message.mentions.users.first();
			is_ai = false;
		}
		if (is_ai) {
			await game_message.edit({
				components: [makeButtons(message.member.user)],
				content: "pick your weapon",
			});
		}
		message.reply("this is wip");
	},
};
