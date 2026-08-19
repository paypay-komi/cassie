const { Events, Client, Message } = require("discord.js");
const { getLogger } = require("../lib/logger");
const prisma = require("../prisma/client");

const log = getLogger("member activity messages");

module.exports = {
	name: Events.MessageCreate,
	description: "updates member activity for every message",

	/**
	 * @param {Client} client
	 * @param {Message<true>} message
	 */
	async execute(client, message) {
		if (!message.guild || message.author.bot) return;

		await prisma.guildMemberActivity.upsert({
			where: {
				guildId_userId: {
					guildId: message.guild.id,
					userId: message.author.id,
				},
			},
			create: {
				guildId: message.guild.id,
				userId: message.author.id,
				messageCount: 1,
			},
			update: {
				messageCount: {
					increment: 1,
				},
			},
		});
	},
};
