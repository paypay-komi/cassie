module.exports = {
	commandId: "dee62729-ab2c-4732-802f-592322dd1578",
	name: "economy",
	aliases: ["eco"],
	description: "Economy system admin commands.",

	async execute(message, args) {
		const prefix = (await message.client.db.guild.getPrefix(message.guildId)) || "c.";
		const available = ["config", "balance", "reset"];
		message.reply(
			`Available subcommands: \`${prefix}economy ${available.join(`\`, \`${prefix}economy `)}\`\n` +
			`Use \`c.help economy\` for details, or \`c.balance\` / \`c.daily\` / \`c.work\` / \`c.pay\` / \`c.leaderboard\` / \`c.transactions\` for user commands.`
		);
	},
};
