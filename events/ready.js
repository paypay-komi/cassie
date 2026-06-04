const { getLogger } = require("../lib/logger");

module.exports = {
	name: "clientReady",
	execute(client) {
		const log = getLogger("Ready");
		log.info(`Shard ready: ${client.user.tag}`);
		log.info(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
		log.info(
			`Serving ${client.guilds.cache.size} guild(s) and ${client.users.cache.size} user(s)`,
		);
		client.guilds.cache.forEach((guild) => {
			const shardId = client.shard?.ids?.[0] ?? 0;
			log.info(`Shard ${shardId} — Guild: ${guild.name}`);
		});
	},
};
