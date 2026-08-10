const {
	ContainerBuilder,
	TextDisplayBuilder,
	MessageFlags,
} = require("discord.js");
const db = require("../../../db");

module.exports = {
	commandId: "e1a4efda-c860-451a-bf3d-c59fbbe5eae8",
	name: "ClaimVoteStreak",
	description: "Claim your vote reward. Streaks increase the payout.",
	category: {
		name: "Economy",
		emoji: "💰",
		description: "Currency, rewards, and voting.",
		order: 50,
	},

	async execute(message, args) {
		const econ = db.economy;
		const result = await econ.claimVoteStreakReward(
			message.guildId,
			message.author.id,
		);
		const config = await econ.getConfig(message.guildId);

		const name =
			result.amount === 1
				? config.currencyName
				: config.currencyNamePlural;
		const sym = config.currencySymbol;

		let text;
		if (result.success) {
			text = `${sym} **${result.amount.toLocaleString()}** ${name}`;
			if (result.streak > 1)
				text += `\n🔥 **${result.streak}-vote streak!**`;
		} else {
			text = result.message;
		}

		const container = new ContainerBuilder().addTextDisplayComponents(
			new TextDisplayBuilder().setContent(text),
		);

		message.reply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});
	},
};
