const { PermissionsBitField } = require("discord.js");
module.exports = {
	commandId: "8a26df69-1f05-4d64-89bd-6ab94533ec77",
	name: "list",
	parent: "tickets",
	description: "List open tickets",
	usage: "tickets list",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		const tickets = await prisma.ticket.findMany({
			where: { guildId: guild.id, status: "open" },
			orderBy: { createdAt: "desc" },
		});

		if (!tickets.length) return message.reply(buildMessage("No open tickets.", 0x57f287));

		const lines = [];
		for (const t of tickets.slice(0, 15)) {
			const ch = guild.channels.cache.get(t.channelId);
			const creator = await guild.members.fetch(t.creatorId).catch(() => null);
			lines.push(`${ch ? `${ch}` : `\`${t.channelId}\``} — ${creator ? creator.user.tag : t.creatorId} — <t:${Math.floor(new Date(t.createdAt).getTime() / 1000)}:R>`);
		}

		return message.reply(buildMessage(`## 🎫 Open Tickets (${tickets.length})\n${lines.join("\n")}`, 0x5865f2));
	},
};