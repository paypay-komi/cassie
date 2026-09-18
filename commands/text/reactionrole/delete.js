const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const db = require("../../../db");
const trackedMessages = require("../../../lib/reactionRoleCache");

module.exports = {
	commandId: "b3c4d5e6-f7a8-9012-bcde-f23456789012",
	name: "delete",
	description: "Delete a reaction role message",
	parent: "reactionrole",
	dmUse: false,
	guildUse: true,
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages],
	async execute(message, args) {
		const guild = message.guild;
		if (!guild) return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ❌ Server only`)).setAccentColor(0xed4245)], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });

		if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
			return message.reply({ content: "You need the **Manage Roles** permission.", allowedMentions: { parse: [] } });
		}

		if (!args[0]) {
			return message.reply({ content: "Usage: `c.reactionrole delete <messageId>`\nGet the message ID from the reaction role message or `c.reactionrole list`.", allowedMentions: { parse: [] } });
		}

		const msgId = args[0];
		const rr = await db.prisma.reactionRole.findUnique({
			where: { messageId: msgId },
			include: { entries: true },
		}).catch(() => null);

		if (!rr || rr.guildId !== guild.id) {
			return message.reply({ content: "No reaction role found with that message ID in this server.", allowedMentions: { parse: [] } });
		}

		// Try to delete the message
		const channel = guild.channels.cache.get(rr.channelId);
		if (channel) {
			const msg = await channel.messages.fetch(msgId).catch(() => null);
			if (msg) await msg.delete().catch(() => {});
		}

		// Delete from DB (cascades to entries)
		await db.prisma.reactionRole.delete({ where: { id: rr.id } }).catch(() => {});

		// Remove from cache
		trackedMessages.delete(msgId);

		return message.reply({
			components: [new ContainerBuilder()
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✅ Reaction Role Deleted\nRemoved ${rr.entries.length} role mapping(s).`))
				.setAccentColor(0x57f287)],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		});
	},
};
