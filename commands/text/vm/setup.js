const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const vm = require("../../../lib/voiceMaster");
module.exports = {
	commandId: "5eda3135-d566-4089-b84d-a171cf2f7272",
	name: "setup",
	parent: "vm",
	description: "Configure the VoiceMaster system",
	usage: "vm setup <category> [hub voice channel]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		const category = message.mentions.channels.find((c) => c.type === 4) || (args[0] && guild.channels.cache.get(args[0].replace(/[<#>]/g, "")));
		if (!category || category.type !== 4) return message.reply(buildMessage("Mention or ID a **category** channel.", 0xe05252));

		const cfg = await vm.ensureConfig(prisma, guild.id);
		await prisma.voiceMasterConfig.update({ where: { guildId: guild.id }, data: { categoryId: category.id } });

		const hubChannel = message.mentions.channels.find((c) => c.type === 2 && c.id !== category.id);
		if (hubChannel) {
			await prisma.voiceMasterHub.upsert({
				where: { guildId_channelId: { guildId: guild.id, channelId: hubChannel.id } },
				create: { guildId: guild.id, channelId: hubChannel.id, name: hubChannel.name },
				update: { name: hubChannel.name },
			});
		}

		return message.reply(buildMessage("VoiceMaster configured!\n**Category:** " + category + (hubChannel ? "\n**Hub:** " + hubChannel : ""), 0x57f287));
	},
};