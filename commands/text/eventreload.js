module.exports = {
    name: 'reloadevent',
    description: 'Reload event handlers',
    permissions: ['botOwner'],
    async execute(message, args) {
        const reloadEvents = require('../../utils/reloadEvents');
        reloadEvents(message.client);
        await message.reply('✅ Event handlers reloaded!');
    }
};
// brb bathroom
