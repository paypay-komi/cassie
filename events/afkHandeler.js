const { Events } = require("discord.js");
const { time } = require("discord.js");
const db = require("../db");

function safeCreateMention(afkUserId, message) {
	// fire-and-forget, don't block reply
	db.prisma.globalAfkMention
		.create({
			data: {
				userId: afkUserId,
				guildId: message.guildId || "DM",
				channelId: message.channelId,
				messageId: message.id,
				mentionedBy: message.author.id,
			},
		})
		.catch(() => {});
	db.prisma.globalAfkUser
		.update({
			where: { userId: afkUserId },
			data: { mentionCount: { increment: 1 } },
		})
		.catch(() => {});
}

module.exports = {
	name: Events.MessageCreate,
	async execute(client, message) {
		if (message.author.bot) return;

		const mentions = message.mentions;
		if (mentions.users.size === 0) return;
		let final_message = "";
		for (const user of mentions.users.values()) {
			const afk_data = client.afk.get(user.id);
			if (!afk_data) continue;
			const date = new Date(afk_data.since);

			final_message += `<@${afk_data.userId}> has been afk since: ${time(date)} (${time(date, "R")})\n reason: ${afk_data.reason}\n`;
			safeCreateMention(user.id, message);
		}
		if (final_message == "") return;
		message.reply(final_message).catch(() => {});
	},
};
