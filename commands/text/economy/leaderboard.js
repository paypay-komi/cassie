const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

function v2(text) {
	return { components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {

commandId: "fd15fb47-ac8c-4b08-bd85-d0a65dab03dc",
	name: "leaderboard",
	aliases: ["lb", "top"],
	description: "View the richest users.",

	async execute(message, args) {
		const econ = message.client.db.economy;
		const config = await econ.getConfig(message.guildId);
		const entries = await econ.getLeaderboard(message.guildId, 10);

		if (entries.length === 0) return message.reply(v2("No economy users yet."));

		const lines = entries.map((e, i) => {
			const medal = i === 0 ? "\u{1F947}" : i === 1 ? "\u{1F948}" : i === 2 ? "\u{1F949}" : `**#${i + 1}**`;
			const name = e.balance === 1 ? config.currencyName : config.currencyNamePlural;
			return `${medal} <@${e.userId}> — ${config.currencySymbol}**${e.balance.toLocaleString()}** ${name}`;
		});

		message.reply(v2(lines.join("\n")));
	},
};
