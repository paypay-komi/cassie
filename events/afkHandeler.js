const { JsonNull } = require("@prisma/client/runtime/client");
const { Events } = require("discord.js");

module.exports = {
	name: Events.MessageCreate,
	execute(client, message) {
		if (message.author.bot) return;

		const mentions = message.mentions;
		if (mentions.users.size === 0) return;
		let final_message = "";
		for (const user of mentions.users.values()) {
			const afk_data = client.afk.get(user.id);
			if (!afk_data) continue;
			final_message += `<@${afk_data.userId}> has been afk since: ${afk_data.since}\n reason: ${afk_data.reason}\n`;
		}
		message.reply(final_message);
	},
};
