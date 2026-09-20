const { Events } = require("discord.js");
const starboard = require("../lib/starboard");
const { getLogger } = require("../lib/logger");

const log = getLogger("Starboard");

module.exports = {
	name: Events.MessageReactionRemove,
	async execute(client, reaction, user) {
		try {
			await starboard.handleRemove(client, reaction, user);
		} catch (err) {
			log.warn(`Starboard remove failed: ${err.message}`);
		}
	},
};
