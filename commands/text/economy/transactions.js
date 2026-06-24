const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

function v2(text) {
	return { components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {

commandId: "479d9cc3-5340-458a-a36b-8f8a0ffb6552",
	name: "transactions",
	aliases: ["tx", "history"],
	description: "View your transaction history.",

	async execute(message, args) {
		const econ = message.client.db.economy;
		const config = await econ.getConfig(message.guildId);
		const page = parseInt(args[0], 10) || 1;

		const { rows, total, page: curPage, totalPages } = await econ.getTransactions(
			message.guildId, message.author.id, page, 10
		);

		if (rows.length === 0) return message.reply(v2("No transactions yet."));

		const lines = rows.map(t => {
			const sym = config.currencySymbol;
			const sign = t.amount >= 0 ? "+" : "";
			const name = Math.abs(t.amount) === 1 ? config.currencyName : config.currencyNamePlural;
			const ts = `<t:${Math.floor(t.createdAt.getTime() / 1000)}:R>`;
			return `${ts} ${sign}${sym}${t.amount.toLocaleString()} ${name} — ${t.description || t.type}`;
		});

		message.reply(v2(`**Transactions** (page ${curPage}/${totalPages})\n${lines.join("\n")}`));
	},
};
