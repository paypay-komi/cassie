module.exports = {
	name: "clientReady",
	execute(client) {
		console.log("Shard ready: " + client.user.tag);
		console.log(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
		console.log(
			`Serving ${client.guilds.cache.size} guild(s) and ${client.users.cache.size} user(s)`,
		);
		client.guilds.cache.forEach((guild) => {
			console.log(`Shard ${client.shard.ids[0]} — Guild: ${guild.name}`);
		});
	},
};
