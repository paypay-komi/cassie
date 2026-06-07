const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
	data: new SlashCommandBuilder()
		.setName("help")
		.setDescription("Learn how to use this bot"),
	async execute(interaction) {
		const prefix = "c.";
		await interaction.reply({
			content:
				`This bot uses text commands, not slash commands. Use \`${prefix}help\` to see all commands.\n\n` +
				`Example: \`${prefix}8ball will i win?\``,
			ephemeral: true,
		});
	},
};
