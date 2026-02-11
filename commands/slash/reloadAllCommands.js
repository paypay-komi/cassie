const reloadTextCommands = require("../../utils/reloadTextcommands");
const reloadSlashcommands = require("../../utils/reloadSlashcommands");
const { SlashCommandBuilder } = require('@discordjs/builders');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('reloadall')
        .setDescription('Reloads all commands'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        reloadTextCommands(interaction.client);
        reloadSlashcommands(interaction.client);
        await interaction.editReply({ content: '✅ All commands reloaded!' });
    }
};
