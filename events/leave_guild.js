const { Events } = require("discord.js")
const { getLogger } = require("../lib/logger");

module.exports = {

	name: Events.GuildDelete,
	execute(client, guild) {
		const log = getLogger("GuildLeave");
		log.info(`Left guild: ${guild.name} (${guild.id})`);
	}
}
