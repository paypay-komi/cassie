const { PermissionsBitField, ChannelType } = require("discord.js");
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
		const target =
			message.mentions.channels.first() ||
			(args[1] && guild.channels.cache.get(args[1].replace(/[<#>]/g, "")));

		if (action === "remove") {
			if (!target) return message.reply(buildMessage("Mention or ID a hub channel to remove.", 0xe05252));
			const result = await prisma.voiceMasterHub.deleteMany({ where: { guildId: guild.id, channelId: target.id } });
			if (!result.count) return message.reply(buildMessage("That channel is not a hub.", 0xe05252));
			return message.reply(buildMessage(`Hub removed: ${target}.`, 0x57f287));
		}

		if (action === "add") {
			if (!target || target.type !== ChannelType.GuildVoice) {
				return message.reply(buildMessage("Mention or ID a **voice** channel.", 0xe05252));
			}
			await prisma.voiceMasterHub.upsert({
				where: { guildId_channelId: { guildId: guild.id, channelId: target.id } },
				create: { guildId: guild.id, channelId: target.id, name: target.name },
				update: { name: target.name },
			});
			return message.reply(buildMessage(`Hub added: ${target}. Join it to create a temporary channel.`, 0x57f287));
		}

		const hubs = await prisma.voiceMasterHub.findMany({ where: { guildId: guild.id } });
		const lines = hubs.length
			? hubs.map((hub) => {
				const channel = guild.channels.cache.get(hub.channelId);
				return channel ? `- ${channel}` : `- \`${hub.channelId}\` (missing)`;
			})
			: ["No hubs configured. Run `vm setup` to create one."];

		return message.reply(
			buildMessage(
				"## VoiceMaster Hubs\n" +
				lines.join("\n") +
				"\n\nUse `vm hub add #channel` or `vm hub remove #channel` to change them.",
				0x5865f2,
			),
		);
	},
};
