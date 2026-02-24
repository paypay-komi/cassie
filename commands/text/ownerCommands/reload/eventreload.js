module.exports = {
	name: 'event',
	description: 'Reload event handlers',
	permissions: ['botOwner'],
	parent: 'reload',
	async execute(message, args) {
		const reloadEvents = require('../../../../utils/reloadEvents');
		reloadEvents(message.client);
		await message.reply('✅ Event handlers reloaded!');
	},
};
// brb bathroom
