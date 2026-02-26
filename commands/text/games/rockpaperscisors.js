const { ButtonBuilder } = require("discord.js");
module.exports = {
	name: "rockPaperScissors",
	parent: "games",
	aliases: ["rps"],
	execute(message, args) {
		if (message.mentions.first()) {
		}
		message.reply("this is wip");
	},
};
