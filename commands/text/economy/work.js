const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

function v2(text) {
	return { components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {

commandId: "acd9cf91-fe8b-4f1f-9f27-e4508a262709",
	name: "work",
	description: "Work to earn some coins. Build a streak for bonuses.",

	async execute(message, args) {
		const econ = message.client.db.economy;
		const config = await econ.getConfig(message.guildId);
		if (!config.enabled) return message.reply(v2("Economy is disabled in this server."));

		const check = await econ.canWork(message.guildId, message.author.id);
		if (!check.canWork) {
			return message.reply(v2(
				`You're too tired. Come back <t:${Math.floor(check.cooldownEnd.getTime() / 1000)}:R>`
			));
		}

		const result = await econ.doWork(message.guildId, message.author.id);
		const name = result.amount === 1 ? config.currencyName : config.currencyNamePlural;
		const sym = config.currencySymbol;

		const next = `<t:${Math.floor(result.cooldownEnd.getTime() / 1000)}:R>`;
		let text = `💼 You worked and earned ${sym}**${result.amount.toLocaleString()}** ${name}.\n⏰ Next work: ${next}`;
		if (result.streak > 1) {
			text += `\n🔥 **${result.streak}** work streak (+${result.bonus} bonus)`;
		}

		message.reply(v2(text));
	},
};
