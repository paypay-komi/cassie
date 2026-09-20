const { PermissionsBitField } = require("discord.js");
module.exports = {
	commandId: "986a66b4-a5b3-41c8-8841-b434efc54617",
	name: "removeuser",
	parent: "tickets",
	description: "Remove a user from this ticket",
	usage: "tickets removeuser <@user>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const channel = message.channel;

		const ticket = await prisma.ticket.findUnique({
			where: { guildId_channelId: { guildId: guild.id, channelId: channel.id } },
		});
		if (!ticket) return message.reply(buildMessage("This is not a ticket channel.", 0xe05252));

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to remove.", 0xe05252));

		try {
			await channel.permissionOverwrites.edit(target.id, {
				ViewChannel: false,
				SendMessages: false,
			});
		} catch (err) {
			return message.reply(buildMessage(`Failed: ${err.message}`, 0xe05252));
		}

		return message.reply(buildMessage(`${target} removed from this ticket.`, 0x57f287));
	},
};