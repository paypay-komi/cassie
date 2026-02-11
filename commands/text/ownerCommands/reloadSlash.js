module.exports = {
    name: 'reloadslash',
    description: 'Reload slash commands',
    permissions: ['botOwner'],
    async execute(message, args) {
        const reloadSlashcommands = require('../../../utils/reloadSlashcommands');
        reloadSlashcommands(message.client);
        await message.reply('✅ Slash commands reloaded!');
    }
};
