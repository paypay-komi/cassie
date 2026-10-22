const { buildMessage } = require("../../../lib/v2Reply");
const vm = require("../../../lib/voiceMaster");

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

		const channel = guild.channels.cache.get(channelId);
		if (!channel) return message.reply(buildMessage("Channel not found.", 0xe05252));
		if (channel.members.has(vc.ownerId)) return message.reply(buildMessage("The current owner is still in the channel.", 0xe05252));

		const previousOwner = vc.ownerId;
		vc.ownerId = message.author.id;
		await prisma.voiceChannel.update({ where: { channelId }, data: { ownerId: vc.ownerId } });
		await channel.permissionOverwrites.delete(previousOwner).catch(() => {});

		const cfg = await vm.getConfig(prisma, guild.id);
		await vm.applyPermissions({ client: message.client, guild, channel, vc, cfg });

		return message.reply(buildMessage("You are now the channel owner.", 0x57f287));
	},
};
