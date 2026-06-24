const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

module.exports = {

commandId: "da755842-de42-4232-80e3-5cfb6dd8798e",
	name: "balance",
	aliases: ["bal"],
	description: "View your or another user's balance.",

	async execute(message, args) {
		const econ = message.client.db.economy;
		const target = message.mentions.users.first() || message.author;
		const userId = target.id;
		const guildId = message.guildId;

		const [config, balance, rank] = await Promise.all([
			econ.getConfig(guildId),
			econ.getBalance(guildId, userId),
			econ.getRank(guildId, userId),
		]);

		const name = balance === 1 ? config.currencyName : config.currencyNamePlural;
		const sym = config.currencySymbol;
		const rankStr = rank ? ` (#${rank})` : "";

		const container = new ContainerBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`**${target.displayName}**${rankStr}\n${sym} **${balance.toLocaleString()}** ${name}`
				),
			);

		message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
	},
};
