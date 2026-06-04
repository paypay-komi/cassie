const { Events } = require("discord.js")
const { getLogger } = require("../lib/logger");

module.exports = {

	name: Events.GuildCreate,
	execute(client, guild) {
		const log = getLogger("GuildJoin");
		log.info(`Joined guild: ${guild.name} (${guild.id})`);
	}
}
