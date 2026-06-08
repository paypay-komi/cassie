const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {

commandId: "0c24f948-dfea-4896-b65a-337d4d4476e9",
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
