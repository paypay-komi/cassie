const { SlashCommandBuilder } = require('@discordjs/builders');
const depolySlashcommands = require('../../utils/depolySlashcommands');
const config = require('../../config.json');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('deploy')
        .setDescription('Deploys slash commands to the server'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        await depolySlashcommands({
            token: config.token,
            clientId: config.clientId,
            guildId: interaction.guildId,
            global: true
        });
        await interaction.editReply({ content: '✅ Commands deployed!' });
    }
};
