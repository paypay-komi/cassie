const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {
	commandId: "e4fc9ff8-c8d3-4c55-8b82-ecf60de3a3eb",
	name: "name",
	parent: "vm",
	description: "Rename your temp voice channel",
	usage: "vm name <new name>",
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

		const newName = args.join(" ").replace(/[\r\n]+/g, " ").trim();
		if (!newName) return message.reply(buildMessage("Provide a new name.", 0xe05252));
		if (newName.length > 100) return message.reply(buildMessage("Channel names cannot be longer than 100 characters.", 0xe05252));

		const channel = guild.channels.cache.get(channelId);
		if (!channel) return message.reply(buildMessage("Channel not found.", 0xe05252));

		const updated = await channel.setName(newName).catch(() => null);
		if (!updated) return message.reply(buildMessage("I could not rename that channel.", 0xe05252));

		await prisma.voiceChannel.update({ where: { channelId }, data: { name: newName } });
		return message.reply(buildMessage(`Channel renamed to **${newName}**.`, 0x57f287));
	},
};
