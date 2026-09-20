const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getLogger } = require("../lib/logger");

const log = getLogger("VMInterface");

module.exports = {
	name: "voiceMasterInterface",
	description: "Handles voice master control panel button interactions",

	async execute(client, interaction) {
		if (!interaction.isButton()) return;
		if (!interaction.guild) return;

		const { customId } = interaction;
		if (!customId.startsWith("vm_")) return;

		const prisma = client.db.prisma;
		const guild = interaction.guild;
		const channelId = interaction.channel?.id;

		const vc = await prisma.voiceChannel.findUnique({
			where: { guildId_channelId: { guildId: guild.id, channelId } },
		});
		if (!vc) return interaction.reply({ content: "This is not a managed voice channel.", ephemeral: true });

		const isOwner = vc.ownerId === interaction.user.id;
		const isModerator = interaction.member.permissions.has("ManageChannels");
		if (!isOwner && !isModerator) {
			return interaction.reply({ content: "Only the channel owner or a moderator can use this.", ephemeral: true });
		}

		const ch = guild.channels.cache.get(channelId);
		if (!ch) return interaction.reply({ content: "Channel not found.", ephemeral: true });

		const action = customId.replace("vm_", "");

		if (action === "lock") {
			const locked = !vc.locked;
			await prisma.voiceChannel.update({ where: { channelId }, data: { locked } });
			await ch.permissionOverwrites.edit(guild.roles.everyone, { Connect: !locked }).catch(() => {});
			return interaction.reply({ content: locked ? "🔒 Channel locked." : "🔓 Channel unlocked.", ephemeral: true });
		}

		if (action === "hide") {
			const hidden = !vc.hidden;
			await prisma.voiceChannel.update({ where: { channelId }, data: { hidden } });
			await ch.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: !hidden, Connect: !hidden }).catch(() => {});
			// Keep owner and default role visible
			if (vc.ownerId) await ch.permissionOverwrites.edit(vc.ownerId, { ViewChannel: true, Connect: true }).catch(() => {});
			return interaction.reply({ content: hidden ? "👁️ Channel hidden." : "👁️‍🗨️ Channel visible.", ephemeral: true });
		}

		if (action === "limit") {
			const current = ch.userLimit || 0;
			const next = current >= 99 ? 0 : current + 5;
			await ch.setUserLimit(next).catch(() => {});
			await prisma.voiceChannel.update({ where: { channelId }, data: { userLimit: next } }).catch(() => {});
			return interaction.reply({ content: "👥 User limit set to " + (next || "∞") + ".", ephemeral: true });
		}

		if (action === "rename") {
			return interaction.reply({ content: "Use `/vm name <new name>` to rename your channel.", ephemeral: true });
		}

		if (action === "claim") {
			const members = ch.members;
			if (members.size === 0) {
				return interaction.reply({ content: "Channel is empty — cannot claim.", ephemeral: true });
			}
			if (isOwner) {
				return interaction.reply({ content: "You already own this channel.", ephemeral: true });
			}
			await prisma.voiceChannel.update({ where: { channelId }, data: { ownerId: interaction.user.id } }).catch(() => {});
			await ch.permissionOverwrites.edit(interaction.user.id, {
				ManageChannels: true,
				MoveMembers: true,
			}).catch(() => {});
			return interaction.reply({ content: "👑 Ownership claimed!", ephemeral: true });
		}
	},
};