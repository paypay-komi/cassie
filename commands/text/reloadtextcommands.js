const  reloadTextCommands  = require('../../utils/reloadTextcommands');
module.exports = {
    name: 'reloadtext',
    description: 'Reload text commands',
    permissions: ['botOwner'],
    async execute(message, args) {
        reloadTextCommands(message.client);
        await message.reply('✅ Text commands reloaded!');
    }
};
