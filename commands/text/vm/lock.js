const { buildMessage } = require("../../../lib/v2Reply");
const vm = require("../../../lib/voiceMaster");

module.exports = {
	commandId: "7d9b9617-35ff-467f-8866-d8d931b22b8c",
	name: "lock",
	parent: "vm",
	description: "Lock your temp voice channel",
	usage: "vm lock",
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

		const channel = guild.channels.cache.get(channelId);
		if (!channel) return message.reply(buildMessage("Channel not found.", 0xe05252));

		vc.locked = true;
		await prisma.voiceChannel.update({ where: { channelId }, data: { locked: true } });

		const cfg = await vm.getConfig(prisma, guild.id);
		await vm.applyPermissions({ client: message.client, guild, channel, vc, cfg });

		return message.reply(buildMessage("Channel locked. Only you and staff can join.", 0x57f287));
	},
};
