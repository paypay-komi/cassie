const { PermissionsBitField } = require("discord.js");
module.exports = {
	commandId: "08bd2203-0ce8-4cee-92d1-7b82e52f65ac",
	name: "adduser",
	parent: "tickets",
	description: "Add a user to this ticket",
	usage: "tickets adduser <@user>",
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
		if (!target) return message.reply(buildMessage("Mention a member to add.", 0xe05252));

		try {
			await channel.permissionOverwrites.edit(target.id, {
				ViewChannel: true,
				SendMessages: true,
				ReadMessageHistory: true,
			});
		} catch (err) {
			return message.reply(buildMessage(`Failed: ${err.message}`, 0xe05252));
		}

		return message.reply(buildMessage(`${target} added to this ticket.`, 0x57f287));
	},
};