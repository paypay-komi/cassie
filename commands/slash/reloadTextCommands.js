const { SlashCommandBuilder } = require("@discordjs/builders");
const reloadTextCommands = require("../../utils/reloadTextcommands");
module.exports = {
	data: new SlashCommandBuilder()
		.setName("reloadtext")
		.setDescription("Reloads text commands"),
	async execute(interaction) {
		if (!interaction.client.owners?.includes(interaction.user.id))
			return interaction.reply({ content: "This command can only be used by bot owners.", ephemeral: true });

		await interaction.deferReply({ ephemeral: true });
		reloadTextCommands(interaction.client);
		await interaction.editReply({ content: "✅ Text commands reloaded!" });
	},
};
