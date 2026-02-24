module.exports = {
	name: 'slash',
	description: 'Reload slash commands',
	permissions: ['botOwner'],
	parent: 'reload',
	async execute(message, args) {
		const reloadSlashcommands = require('../../../../utils/reloadSlashcommands');
		reloadSlashcommands(message.client);
		await message.reply('✅ Slash commands reloaded!');
	},
};
