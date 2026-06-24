const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

module.exports = {

commandId: "b08aa355-54ef-4226-8ff3-476a60627380",
	name: "daily",
	description: "Claim your daily reward. Streaks increase the payout.",

	async execute(message, args) {
		const econ = message.client.db.economy;
		const result = await econ.claimDaily(message.guildId, message.author.id);
		const config = await econ.getConfig(message.guildId);

		const name = result.amount === 1 ? config.currencyName : config.currencyNamePlural;
		const sym = config.currencySymbol;

		let text;
		if (result.success) {
			text = `${sym} **${result.amount.toLocaleString()}** ${name}`;
			if (result.streak > 1) text += `\n🔥 **${result.streak}-day streak!**`;
		} else {
			text = result.message;
		}

		const container = new ContainerBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(text),
			);

		message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
	},
};
