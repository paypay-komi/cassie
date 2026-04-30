const { Events } = require("discord.js")
module.exports = {

	name: Events.GuildCreate,
	execute(client, guild) {
		console.log(`new guild ${JSON.stringify(guild,null,2)}`)
	}
}
