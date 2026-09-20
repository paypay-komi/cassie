const { Events } = require("discord.js");
const starboard = require("../lib/starboard");
const { getLogger } = require("../lib/logger");

const log = getLogger("Starboard");

module.exports = {
	name: Events.MessageReactionAdd,
	async execute(client, reaction, user) {
		try {
			await starboard.handleAdd(client, reaction, user);
		} catch (err) {
			log.warn(`Starboard add failed: ${err.message}`);
		}
	},
};
