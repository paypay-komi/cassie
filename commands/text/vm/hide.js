const { buildMessage } = require("../../../lib/v2Reply");
const vm = require("../../../lib/voiceMaster");

module.exports = {
	commandId: "9d4abe5f-3116-4f70-9f9a-40c7ac72a01e",
	name: "hide",
	parent: "vm",
	description: "Hide your temp voice channel",
	usage: "vm hide",
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

		vc.hidden = true;
		await prisma.voiceChannel.update({ where: { channelId }, data: { hidden: true } });

		const cfg = await vm.getConfig(prisma, guild.id);
		await vm.applyPermissions({ client: message.client, guild, channel, vc, cfg });

		return message.reply(buildMessage("Channel hidden.", 0x57f287));
	},
};
