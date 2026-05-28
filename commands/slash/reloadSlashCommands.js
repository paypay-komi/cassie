const reloadSlashcommands = require("../../utils/reloadSlashcommands");
const { SlashCommandBuilder } = require("@discordjs/builders");
module.exports = {
	data: new SlashCommandBuilder()
		.setName("reloadslash")
		.setDescription("Reloads slash commands"),
	async execute(interaction) {
		if (!interaction.client.owners?.includes(interaction.user.id))
			return interaction.reply({ content: "This command can only be used by bot owners.", ephemeral: true });

		await interaction.deferReply({ ephemeral: true });
		reloadSlashcommands(interaction.client);
		await interaction.editReply({ content: "✅ Slash commands reloaded!" });
	},
};
