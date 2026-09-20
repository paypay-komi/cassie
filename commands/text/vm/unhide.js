const { buildMessage } = require("../../../lib/v2Reply");
module.exports = {
	commandId: "a4888e45-6133-44a0-b220-247a37ff9807",
	name: "unhide",
	parent: "vm",
	description: "Unhide your temp voice channel",
	usage: "vm unhide",
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

		await prisma.voiceChannel.update({ where: { channelId }, data: { hidden: false } });
		const ch = guild.channels.cache.get(channelId);
		if (ch) await ch.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true, Connect: true }).catch(() => {});

		return message.reply(buildMessage("👁️‍🗨️ Channel visible.", 0x57f287));
	},
};