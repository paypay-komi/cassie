const { buildMessage } = require("../../../lib/v2Reply");
module.exports = {
	commandId: "f570d853-6b44-42be-877d-51104b53220d",
	name: "bitrate",
	parent: "vm",
	description: "Set bitrate for your temp voice channel",
	usage: "vm bitrate <8-384>",
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

		const n = parseInt(args[0], 10);
		if (isNaN(n) || n < 8 || n > 384) return message.reply(buildMessage("Bitrate must be 8–384 kbps.", 0xe05252));

		const ch = guild.channels.cache.get(channelId);
		if (ch) await ch.setBitrate(n * 1000).catch(() => {});
		await prisma.voiceChannel.update({ where: { channelId }, data: { bitrate: n } });

		return message.reply(buildMessage("🔊 Bitrate set to **" + n + "kbps**.", 0x57f287));
	},
};