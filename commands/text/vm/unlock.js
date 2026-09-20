const { buildMessage } = require("../../../lib/v2Reply");
module.exports = {
	commandId: "1246b783-8cf7-4930-97eb-5e5180c04639",
	name: "unlock",
	parent: "vm",
	description: "Unlock your temp voice channel",
	usage: "vm unlock",
	dmUse: false,

	async execute(message) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const channelId = message.member.voice?.channelId;
		if (!channelId) return message.reply(buildMessage("You must be in a voice channel.", 0xe05252));

		const vc = await prisma.voiceChannel.findUnique({
			where: { guildId_channelId: { guildId: guild.id, channelId } },
		});
		if (!vc || vc.ownerId !== message.author.id) return message.reply(buildMessage("You don't own this channel.", 0xe05252));

		await prisma.voiceChannel.update({ where: { channelId }, data: { locked: false } });
		const ch = guild.channels.cache.get(channelId);
		if (ch) await ch.permissionOverwrites.edit(guild.roles.everyone, { Connect: true }).catch(() => {});

		return message.reply(buildMessage("🔓 Channel unlocked.", 0x57f287));
	},
};