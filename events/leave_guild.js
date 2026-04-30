const { Events } = require("discord.js")
module.exports = {

	name: Events.GuildDelete,
	execute(client, guild) {
		console.log(`left guild ${JSON.stringify(guild,null,2)}`)
	}
}
