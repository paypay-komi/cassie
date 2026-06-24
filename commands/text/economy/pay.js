const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

function v2(text) {
	return { components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {

commandId: "e622eb55-e929-4c73-9ec8-1a0c06ee48e7",
	name: "pay",
	description: "Send coins to another user. A tax may be deducted.",
	guildUse: true,

	async execute(message, args) {
		const econ = message.client.db.economy;
		const target = message.mentions.users.first();
		if (!target) return message.reply(v2("Usage: `c.pay @user <amount>`"));
		if (target.id === message.author.id) return message.reply(v2("You can't pay yourself."));

		const amount = parseInt(args[1], 10);
		if (isNaN(amount) || amount <= 0) return message.reply(v2("Provide a valid positive amount."));

		const config = await econ.getConfig(message.guildId);
		if (!config.enabled) return message.reply(v2("Economy is disabled in this server."));

		try {
			await econ.removeBalance(message.guildId, message.author.id, amount, "pay", `Paid ${target.displayName}`);

			let received = amount;
			let tax = 0;
			if (config.taxRate > 0) {
				tax = Math.floor(amount * config.taxRate / 100);
				received = amount - tax;
			}

			await econ.addBalance(message.guildId, target.id, received, "pay", `Received from ${message.author.displayName}`);

			const name = received === 1 ? config.currencyName : config.currencyNamePlural;
			const sym = config.currencySymbol;

			let text = `${sym} **${received.toLocaleString()}** ${name} sent to ${target}.`;
			if (tax > 0) text += `\n*(Tax: ${sym}${tax.toLocaleString()} ${tax === 1 ? config.currencyName : config.currencyNamePlural} — destroyed)*`;

			message.reply(v2(text));
		} catch (e) {
			if (e.message === "Insufficient balance") {
				message.reply(v2("You don't have enough coins."));
			} else {
				throw e;
			}
		}
	},
};
