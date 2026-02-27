const {
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	Component,
	ComponentType,
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
			const collector = game_message.createMessageComponentCollector({
				componentType: ComponentType.Button,
				idle: 60_000,
			});
			collector.on("collect", (interaction) => {
				if (interaction.user.id !== message.author.id)
					return interaction.reply({
						ephemeral: true,
						content: "this is not your game!!!",
					});
				const [game_id, message_id, user_id, piece] =
					interaction.customId.split("-");

				const random_piece = ["🪨", "📄", "✂️"][
					Math.floor(Math.random() * 3)
				];
				interaction.reply(
					`you played ${piece}\ncomptuer played ${random_piece} `,
				);
			});
			collector.on("end", () => {
				game_message.edit({ components: [] });
			});
		}
		message.reply("this is wip");
	},
};
