const { SlashCommandBuilder } = require('@discordjs/builders');
const reloadTextCommands = require('../../utils/reloadTextcommands');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('reloadtext')
        .setDescription('Reloads text commands'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        reloadTextCommands(interaction.client);
        await interaction.editReply({ content: '✅ Text commands reloaded!' });
    }
};
