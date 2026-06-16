const db = require("../../../db");
const { MessageFlags, PermissionsBitField } = require("discord.js");
const render = require("../../../utils/echoChamberMessageRenderer");
module.exports = {
	commandId: "d0c80746-925d-4383-83ee-0dc34551da22",
	name: "mymessages",
	description: "lists your messages in the queue",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	parent: "echochamber",
	aliases: ["list", "messages", "mine", "mymessage"],
	/**
	 * @param {import("discord.js").Message} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		const messages = await db.prisma.echoMessage.findMany({
			where: { deliveredAt: null, authorId: message.author.id },
			orderBy: { createdAt: "desc" },
		});
		if (!messages.length)
			return message.reply("you have no messages in the queue");
		const group = render(messages, 0, 5, message.author.id);
		message.reply({
			components: [group],
			flags: MessageFlags.IsComponentsV2,
		});
	},
};
