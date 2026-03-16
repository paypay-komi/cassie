const { JsonNull } = require("@prisma/client/runtime/client");
const { Events } = require("discord.js");
const { time } = require("discord.js");

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
			const date = new Date(afk_data.since);

			final_message += `<@${afk_data.userId}> has been afk since: ${time(date)} (${time(date, "R")})\n reason: ${afk_data.reason}\n`;
		}
		if (final_message == "") return;
		message.reply(final_message);
	},
};
