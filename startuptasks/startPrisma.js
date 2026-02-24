module.exports = {
	name: 'startPrisma',
	description: 'Start Prisma client on startup',
	reloadAble: false,
	execute(client) {
		client.db = require('../db/boobs.js'); // Prisma client instance
		console.log('✅ Prisma client started on startup');
	},
};
