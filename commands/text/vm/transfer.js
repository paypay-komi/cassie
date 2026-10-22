const { buildMessage } = require("../../../lib/v2Reply");
const vm = require("../../../lib/voiceMaster");

module.exports = {
	commandId: "c964ada9-4dbc-4ec7-9772-bdac6f4fb142",
	name: "transfer",
	parent: "vm",
	description: "Transfer ownership of your temp voice channel",
	usage: "vm transfer <@user>",
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

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to transfer to.", 0xe05252));
		if (target.id === vc.ownerId) return message.reply(buildMessage("That member already owns the channel.", 0xe05252));

		const channel = guild.channels.cache.get(channelId);
		if (!channel) return message.reply(buildMessage("Channel not found.", 0xe05252));
		if (!channel.members.has(target.id)) return message.reply(buildMessage("That member must be in your channel.", 0xe05252));

		const previousOwner = vc.ownerId;
		vc.ownerId = target.id;
		await prisma.voiceChannel.update({ where: { channelId }, data: { ownerId: vc.ownerId } });
		await channel.permissionOverwrites.delete(previousOwner).catch(() => {});

		const cfg = await vm.getConfig(prisma, guild.id);
		await vm.applyPermissions({ client: message.client, guild, channel, vc, cfg });

		return message.reply(buildMessage(`Ownership transferred to ${target}.`, 0x57f287));
	},
};
