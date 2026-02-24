const reloadSlashcommands = require('../../utils/reloadSlashcommands');
const { SlashCommandBuilder } = require('@discordjs/builders');
module.exports = {
 data: new SlashCommandBuilder()
  .setName('reloadslash')
  .setDescription('Reloads slash commands'),
 async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        reloadSlashcommands(interaction.client);
        await interaction.editReply({ content: '✅ Slash commands reloaded!' });
    }
};
