const { PermissionFlagsBits, ChannelType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getLogger } = require("./logger");

const log = getLogger("VoiceMaster");

async function getConfig(prisma, guildId) {
	return prisma.voiceMasterConfig.findUnique({ where: { guildId } });
}

async function ensureConfig(prisma, guildId) {
	return prisma.voiceMasterConfig.upsert({
		where: { guildId },
		create: { guildId },
		update: {},
	});
}

async function createTempChannel({ client, guild, creator, prisma }) {
	const cfg = await getConfig(prisma, guild.id);
	if (!cfg || !cfg.categoryId) return { error: "Voice master not configured." };

	const category = guild.channels.cache.get(cfg.categoryId);
	const name = (cfg.defaultName || "{user}'s channel").replace("{user}", creator.displayName);

	const channel = await guild.channels.create({
		name: name,
		type: ChannelType.GuildVoice,
		parent: cfg.categoryId,
		bitrate: (cfg.defaultBitrate || 64) * 1000,
		userLimit: cfg.defaultUserLimit || 0,
		reason: "VoiceMaster temp channel",
	}).catch((err) => {
		log.error("Failed to create temp channel: " + err.message);
		return null;
	});

	if (!channel) return { error: "Failed to create the voice channel." };

	const permOverwrites = [
		{ id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
		{ id: creator.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
		{ id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageRoles] },
	];
	if (cfg.defaultRoleId) {
		permOverwrites.push({ id: cfg.defaultRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] });
	}
	await channel.permissionOverwrites.set(permOverwrites).catch(() => {});

	await prisma.voiceChannel.create({
		data: {
			guildId: guild.id,
			channelId: channel.id,
			ownerId: creator.id,
			bitrate: cfg.defaultBitrate || 64,
			name: name,
		},
	});

	if (cfg.interfaceEnabled) {
		const container = buildInterface(name, creator.id, false, false, 0);
		await channel.send({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		}).catch(() => {});
	}

	return { channelId: channel.id, channel };
}

async function deleteEmptyChannels(client, prisma) {
	const configs = await prisma.voiceMasterConfig.findMany({ where: { temporary: true } });
	for (const cfg of configs) {
		const guild = client.guilds.cache.get(cfg.guildId);
		if (!guild) continue;
		const channels = await prisma.voiceChannel.findMany({ where: { guildId: cfg.guildId } });
		for (const vc of channels) {
			const ch = guild.channels.cache.get(vc.channelId);
			if (!ch || ch.members.size === 0) {
				if (ch) await ch.delete("Empty temp channel").catch(() => {});
				await prisma.voiceChannel.delete({ where: { channelId: vc.channelId } }).catch(() => {});
				await prisma.voiceChannelMember.deleteMany({ where: { channelId: vc.channelId } }).catch(() => {});
			}
		}
	}
}

function buildInterface(name, ownerId, locked, hidden, userLimit) {
	const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require("discord.js");
	const container = new ContainerBuilder()
		.setAccentColor(locked || hidden ? 0xe05252 : 0x57f287)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				"## " + (locked ? "🔒 " : "") + (hidden ? "👁️ " : "") + name +
				"\nOwner: <@" + ownerId + ">" +
				"\nLimit: " + (userLimit || "∞") +
				"\n\nUse the buttons below to manage your channel."
			),
		);

	const row1 = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("vm_lock").setEmoji("🔒").setStyle(locked ? ButtonStyle.Success : ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId("vm_hide").setEmoji("👁️").setStyle(hidden ? ButtonStyle.Success : ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId("vm_limit").setEmoji("👥").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId("vm_rename").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId("vm_claim").setEmoji("👑").setStyle(ButtonStyle.Primary),
	);
	container.addActionRowComponents(row1);

	return container;
}

module.exports = { getConfig, ensureConfig, createTempChannel, deleteEmptyChannels, buildInterface };