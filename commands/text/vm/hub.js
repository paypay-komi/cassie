const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
module.exports = {
	commandId: "b181da81-7fdf-4607-9969-937300148ec4",
	name: "hub",
	parent: "vm",
	description: "Add or remove a join-to-create hub voice channel",
	usage: "vm hub <add|remove> <#voice-channel>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const action = (args[0] || "").toLowerCase();

		if (action === "remove") {
			const ch = message.mentions.channels.first();
			if (!ch) return message.reply(buildMessage("Mention a hub channel to remove.", 0xe05252));
			await prisma.voiceMasterHub.deleteMany({ where: { guildId: guild.id, channelId: ch.id } });
			return message.reply(buildMessage("Hub removed: " + ch + ".", 0x57f287));
		}

		if (action === "add") {
			const ch = message.mentions.channels.first();
			if (!ch || ch.type !== 2) return message.reply(buildMessage("Mention a **voice** channel.", 0xe05252));
			await prisma.voiceMasterHub.upsert({
				where: { guildId_channelId: { guildId: guild.id, channelId: ch.id } },
				create: { guildId: guild.id, channelId: ch.id, name: ch.name },
				update: { name: ch.name },
			});
			return message.reply(buildMessage("Hub added: " + ch + ". Join it to create a temp channel.", 0x57f287));
		}

		return message.reply(buildMessage("Usage: `vm hub <add|remove> <#channel>`", 0xe05252));
	},
};