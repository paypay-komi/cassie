const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

function v2(text) {
	return { components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {

commandId: "e0275f5b-c29b-49fb-849b-4f77227bee6c",
	name: "coinflip",
	aliases: ["flip", "cf"],
	description: "Flip a coin. Pick heads or tails and bet on it.",

	async execute(message, args) {
		const econ = message.client.db.economy;
		const config = await econ.getConfig(message.guildId);
		if (!config.enabled) return message.reply(v2("Economy is disabled in this server."));

		const side = (args[0] || "").toLowerCase();
		if (!["heads", "tails", "h", "t"].includes(side)) return message.reply(v2("Pick `heads` or `tails`.\nUsage: `c.flip heads/tails <amount>`"));

		const amount = parseInt(args[1], 10);
		if (isNaN(amount) || amount <= 0) return message.reply(v2("Provide a valid bet amount."));

		const balance = await econ.getBalance(message.guildId, message.author.id);
		if (balance < amount) return message.reply(v2("You don't have enough to bet that much."));

		const pick = side === "heads" || side === "h" ? "heads" : "tails";
		const result = Math.random() < 0.5 ? "heads" : "tails";
		const win = pick === result;
		const payout = win ? amount + amount : 0;
		const diff = payout - amount;

	const sym = config.currencySymbol;
	const name = amount === 1 ? config.currencyName : config.currencyNamePlural;

	if (win) {
		await econ.addBalance(message.guildId, message.author.id, amount, "coinflip", `Won coinflip (${pick})`);
	} else {
		await econ.removeBalance(message.guildId, message.author.id, amount, "coinflip", `Lost coinflip (${pick})`);
	}

	const emoji = result === "heads" ? "\u{1FA99}" : "\u{1FAB4}";
	const verb = win ? "gained" : "lost";
	const newBal = await econ.getBalance(message.guildId, message.author.id);
	const balName = newBal === 1 ? config.currencyName : config.currencyNamePlural;
	message.reply(v2(`${emoji} **${result}** | You picked **${pick}**\n${verb} ${sym}**${amount.toLocaleString()}** ${name}\nBalance: ${sym}**${newBal.toLocaleString()}** ${balName}`));
	},
};
