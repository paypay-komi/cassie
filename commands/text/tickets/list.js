const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {
	commandId: "8a26df69-1f05-4d64-89bd-6ab94533ec77",
	name: "list",
	parent: "tickets",
	description: "List open tickets",
	usage: "tickets list",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		const openTickets = await prisma.ticket.findMany({
			where: {
				guildId: guild.id,
				status: { in: ["open", "claimed"] },
			},
			orderBy: { createdAt: "desc" },
		});

		if (!openTickets.length) {
			return message.reply(buildMessage("No open tickets.", 0x57f287));
		}

		const lines = [];
		for (const ticket of openTickets.slice(0, 15)) {
			const channel = guild.channels.cache.get(ticket.channelId);
			const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
			lines.push(
				`${channel ? `${channel}` : `\`${ticket.channelId}\``} — ${
					owner ? owner.user.tag : ticket.ownerId
				} — <t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:R>`,
			);
		}

		return message.reply(
			buildMessage(
				`## 🎫 Open Tickets (${openTickets.length})\n${lines.join("\n")}`,
				0x5865f2,
			),
		);
	},
};
