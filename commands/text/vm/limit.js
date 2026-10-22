const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {
	commandId: "56b255bd-d010-45c1-b8fd-ee7fb8e58dc9",
	name: "limit",
	parent: "vm",
	description: "Set user limit for your temp voice channel",
	usage: "vm limit <number|0>",
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

		const n = Number.parseInt(args[0], 10);
		if (!Number.isInteger(n) || n < 0 || n > 99) {
			return message.reply(buildMessage("Provide a user limit from 0 (unlimited) to 99.", 0xe05252));
		}

		const channel = guild.channels.cache.get(channelId);
		if (!channel) return message.reply(buildMessage("Channel not found.", 0xe05252));

		const updated = await channel.setUserLimit(n).catch(() => null);
		if (!updated) return message.reply(buildMessage("I could not update the user limit.", 0xe05252));

		await prisma.voiceChannel.update({ where: { channelId }, data: { userLimit: n } });
		return message.reply(buildMessage(`User limit set to **${n || "unlimited"}**.`, 0x57f287));
	},
};
