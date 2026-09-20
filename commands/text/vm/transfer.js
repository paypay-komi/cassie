const { buildMessage } = require("../../../lib/v2Reply");
module.exports = {
	commandId: "c964ada9-4dbc-4ec7-9772-bdac6f4fb142",
	name: "transfer",
	parent: "vm",
	description: "Transfer ownership of your temp voice channel",
	usage: "vm transfer <@user>",
	dmUse: false,

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const channelId = message.member.voice?.channelId;
		if (!channelId) return message.reply(buildMessage("You must be in a voice channel.", 0xe05252));

		const vc = await prisma.voiceChannel.findUnique({
			where: { guildId_channelId: { guildId: guild.id, channelId } },
		});
		if (!vc || vc.ownerId !== message.author.id) return message.reply(buildMessage("You don't own this channel.", 0xe05252));

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to transfer to.", 0xe05252));

		const ch = guild.channels.cache.get(channelId);
		if (!ch) return message.reply(buildMessage("Channel not found.", 0xe05252));

		const targetMember = ch.members.get(target.id);
		if (!targetMember) return message.reply(buildMessage("That user must be in your channel.", 0xe05252));

		await prisma.voiceChannel.update({ where: { channelId }, data: { ownerId: target.id } });
		await ch.permissionOverwrites.edit(target.id, {
			ManageChannels: true,
			MoveMembers: true,
		}).catch(() => {});

		return message.reply(buildMessage("👑 Ownership transferred to " + target + "!", 0x57f287));
	},
};