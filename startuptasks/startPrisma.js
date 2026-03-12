const { priority } = require('./initClientVars.js');

module.exports = {
	name: 'startPrisma',
	description: 'Start Prisma client on startup',
	reloadAble: false,
	priority: 10000000000,
	execute(client) {
		client.db = require('../db/boobs.js'); // Prisma client instance
		console.log('✅ Prisma client started on startup');
	},
};
