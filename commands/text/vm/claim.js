const { buildMessage } = require("../../../lib/v2Reply");
module.exports = {
	commandId: "28e939e1-53c1-410b-adb4-546113f28eda",
	name: "claim",
	parent: "vm",
	description: "Claim ownership of a temp voice channel",
	usage: "vm claim",
	dmUse: false,

	async execute(message) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const channelId = message.member.voice?.channelId;
		if (!channelId) return message.reply(buildMessage("You must be in a voice channel.", 0xe05252));

		const vc = await prisma.voiceChannel.findUnique({
			where: { guildId_channelId: { guildId: guild.id, channelId } },
		});
		if (!vc) return message.reply(buildMessage("This is not a managed voice channel.", 0xe05252));
		if (vc.ownerId === message.author.id) return message.reply(buildMessage("You already own this channel.", 0xe05252));

		const ch = guild.channels.cache.get(channelId);
		if (!ch || ch.members.size === 0) return message.reply(buildMessage("Channel is empty — cannot claim.", 0xe05252));

		await prisma.voiceChannel.update({ where: { channelId }, data: { ownerId: message.author.id } });
		await ch.permissionOverwrites.edit(message.author.id, {
			ManageChannels: true,
			MoveMembers: true,
		}).catch(() => {});

		return message.reply(buildMessage("👑 Ownership claimed!", 0x57f287));
	},
};