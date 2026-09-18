const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const db = require("../../../db");

module.exports = {
	commandId: "c4d5e6f7-a8b9-0123-cdef-234567890123",
	name: "list",
	description: "List all reaction roles in this server",
	parent: "reactionrole",
	dmUse: false,
	guildUse: true,
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],
	async execute(message, args) {
		const guild = message.guild;
		if (!guild) return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ❌ Server only`)).setAccentColor(0xed4245)], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });

		const rrs = await db.prisma.reactionRole.findMany({
			where: { guildId: guild.id },
			include: { entries: true },
			orderBy: { createdAt: "desc" },
		}).catch(() => []);

		if (!rrs.length) {
			return message.reply({
				components: [new ContainerBuilder()
					.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎭 Reaction Roles\nNo reaction roles configured.\n\nUse \`c.reactionrole create #channel 😀 @Role\` to add one.`))
					.setAccentColor(0xfee75c)],
				flags: MessageFlags.IsComponentsV2,
				allowedMentions: { parse: [] },
			});
		}

		const lines = rrs.map((rr) => {
			const ch = guild.channels.cache.get(rr.channelId);
			const chStr = ch ? `${ch}` : `Channel ${rr.channelId}`;
			const roles = rr.entries.map((e) => {
				const role = guild.roles.cache.get(e.roleId);
				const emoji = e.emoji.startsWith("custom:") ? `<:${e.emoji}>` : e.emoji;
				return `${emoji} → ${role || `Role ${e.roleId}`}`;
			}).join(", ");
			const age = Math.floor((Date.now() - rr.createdAt.getTime()) / 86400000);
			return `**${chStr}** — [Jump](https://discord.com/channels/${guild.id}/${rr.channelId}/${rr.messageId}) — ${rr.entries.length} roles — ${age}d ago\n${roles}`;
		});

		const container = new ContainerBuilder()
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎭 Reaction Roles (${rrs.length})`))
			.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n\n").slice(0, 3800)))
			.setAccentColor(0x5865f2);

		return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
	},
};
