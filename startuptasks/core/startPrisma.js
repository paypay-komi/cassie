const { getLogger } = require("../../lib/logger");
const { priority } = require("./initClientVars.js");

module.exports = {
	name: "startPrisma",
	description: "Start Prisma client on startup",
	reloadAble: false,
	execute(client) {
		const log = getLogger("StartPrisma");
		client.db = require("../../db"); // Prisma client instance
		log.info("✅ Prisma client started on startup");
	},
};
