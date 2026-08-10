module.exports = {
	commandId: "415e5978-48b1-4edc-921f-0814fec8a584",
	name: "animal",
	aliases: ["animals"],
	description: "View animal images and facts.",

	category: {
		name: "Fun",
		emoji: "🐾",
		description: "Fun commands, animals, and entertainment.",
		order: 40,
	},

	usage: "{prefix}animal <subcommand>",

	examples: [
		"{prefix}animal cat",
		"{prefix}animal dog",
	],
};
