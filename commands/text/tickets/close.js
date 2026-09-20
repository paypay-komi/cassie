const { PermissionsBitField } = require("discord.js");
const tickets = require("../../../lib/tickets");
const { buildMessage } = require("../../../lib/v2Reply");
module.exports = {
	commandId: "779e7d35-d1ff-4b5f-94f8-c46e50b7e800",
	name: "close",
	parent: "tickets",
	description: "Close the current ticket",
	usage: "tickets close [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;
		const channelId = message.channel.id;

		const ticket = await prisma.ticket.findUnique({
			where: { guildId_channelId: { guildId: guild.id, channelId } },
		});
		if (!ticket) return message.reply(buildMessage("This is not a ticket channel.", 0xe05252));

		const reason = args.join(" ") || "No reason provided";
		const result = await tickets.closeTicket({ client, guild, channelId, closedBy: message.author.id, prisma, reason });
		if (result.error) return message.reply(buildMessage(result.error, 0xe05252));

		return message.reply(buildMessage("Ticket closed.", 0xe05252));
	},
};