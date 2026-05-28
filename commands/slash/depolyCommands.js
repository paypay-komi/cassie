const { SlashCommandBuilder } = require("@discordjs/builders");
const depolySlashcommands = require("../../utils/depolySlashcommands");
const config = require("../../config.json");
module.exports = {
	data: new SlashCommandBuilder()
		.setName("deploy")
		.setDescription("Deploys slash commands to the server"),
	async execute(interaction) {
		if (!interaction.client.owners?.includes(interaction.user.id))
			return interaction.reply({ content: "This command can only be used by bot owners.", ephemeral: true });

		await interaction.deferReply({ ephemeral: true });

		await depolySlashcommands({
			token: config.token,
			clientId: config.clientId,
			guildId: interaction.guildId,
			global: true,
		});
		await interaction.editReply({ content: "✅ Commands deployed!" });
	},
};
