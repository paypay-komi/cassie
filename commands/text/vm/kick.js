const { buildMessage } = require("../../../lib/v2Reply");
module.exports = {
	commandId: "f965539e-99c7-4565-af4d-e5823a116da8",
	name: "kick",
	parent: "vm",
	description: "Kick a user from your temp voice channel",
	usage: "vm kick <@user>",
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
		if (!target) return message.reply(buildMessage("Mention a member to kick.", 0xe05252));

		const ch = guild.channels.cache.get(channelId);
		if (!ch) return message.reply(buildMessage("Channel not found.", 0xe05252));

		const targetMember = ch.members.get(target.id);
		if (!targetMember) return message.reply(buildMessage("That user is not in your channel.", 0xe05252));

		await targetMember.voice.disconnect("Kicked from voice channel by owner").catch(() => {});

		return message.reply(buildMessage(target.user.tag + " kicked from the channel.", 0x57f287));
	},
};