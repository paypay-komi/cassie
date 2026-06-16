const { Events, Client, Interaction, MessageFlags } = require("discord.js");
const { getLogger } = require("../lib/logger");
const db = require("../db");
const render = require("../utils/echoChamberMessageRenderer");

const log = getLogger("echoChamberMessagePaganation/deletingHandeler");

module.exports = {
	name: Events.InteractionCreate,
	description:
		"handels the message pagantion for the echo chamber messages and the deleting",

	/**
	 * @param {Client} client
	 * @param {Interaction} interaction
	 */
	async execute(client, interaction) {
		if (!interaction.isButton()) return;
		const [prefix, action, authorId, ...args] =
			interaction.customId.split("_");
		if (prefix != "echoChamberMessage") return;
		if (authorId != interaction.user.id)
			return interaction.reply({
				content: " this is not your message >:c",
				flags: MessageFlags.Ephemeral,
			});
		switch (action) {
			case "delete":
				const [messageId, skip] = args;
				await db.prisma.echoMessage.delete({
					where: { id: messageId },
				});
				const messages = await db.prisma.echoMessage.findMany({
					where: {
						deliveredAt: null,
						authorId,
					},
					orderBy: { createdAt: "desc" },
					skip: parseInt(skip),
				});

				interaction.update({
					components: [render(messages, skip, 5, authorId)],
					flags: MessageFlags.IsComponentsV2,
				});
				break;
			case "changePage":
				const newSkip = parseInt(args[0]);
				if (newSkip < 0) {
					return interaction.reply({
						content: "you're already on the first page",
						flags: MessageFlags.Ephemeral,
					});
				}
				const pageMessages = await db.prisma.echoMessage.findMany({
					where: {
						deliveredAt: null,
						authorId,
					},
					orderBy: { createdAt: "desc" },
					skip: newSkip,
				});
				if (!pageMessages.length) {
					return interaction.reply({
						content: "no more messages",
						flags: MessageFlags.Ephemeral,
					});
				}
				interaction.update({
					components: [render(pageMessages, newSkip, 5, authorId)],
					flags: MessageFlags.IsComponentsV2,
				});
				break;
			default:
				log.warn(`invalid action: ${action}`);
				interaction.reply({
					content:
						"oops!! this shouldn't have happened :C try again later!!!",
					flags: MessageFlags.Ephemeral,
				});
				break;
		}
	},
};
