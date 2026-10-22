const {
	PermissionFlagsBits,
	ChannelType,
	MessageFlags,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	TextDisplayBuilder,
} = require("discord.js");
const { getLogger } = require("./logger");

const log = getLogger("VoiceMaster");

const PANEL_TOPIC = "VoiceMaster control panel";
const PANEL_CHANNEL_NAME = "voice-controls";
const HUB_CHANNEL_NAME = "Join to Create";
const DEFAULT_CATEGORY_NAME = "Voice Channels";

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

function maxBitrateKbps(guild) {
	const max = Number(guild?.maximumBitrate);
	if (!Number.isFinite(max) || max <= 0) return 96;
	return Math.min(384, Math.max(8, Math.floor(max / 1000)));
}

function clampUserLimit(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.min(99, Math.max(0, Math.floor(n)));
}

function sanitizeChannelName(value, fallback = "Voice channel") {
	const name = String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 100);
	return name || fallback;
}

function button(customId, label, style = ButtonStyle.Secondary) {
	return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}

function buildControlRows({ locked = false, hidden = false } = {}) {
	const row1 = new ActionRowBuilder().addComponents(
		button("vm_rename", "Rename"),
		button("vm_lock", locked ? "Unlock" : "Lock", locked ? ButtonStyle.Success : ButtonStyle.Secondary),
		button("vm_hide", hidden ? "Show" : "Hide", hidden ? ButtonStyle.Success : ButtonStyle.Secondary),
		button("vm_limit", "Limit"),
		button("vm_bitrate", "Bitrate"),
	);

	const row2 = new ActionRowBuilder().addComponents(
		button("vm_permit", "Permit"),
		button("vm_kick", "Kick"),
		button("vm_transfer", "Transfer"),
		button("vm_claim", "Claim", ButtonStyle.Primary),
		button("vm_delete", "Delete", ButtonStyle.Danger),
	);

	return [row1, row2];
}

function buildInterface({ name, ownerId, locked = false, hidden = false, userLimit = 0, bitrate = 64 }) {
	const status = [
		`Owner: <@${ownerId}>`,
		`Locked: ${locked ? "Yes" : "No"} | Hidden: ${hidden ? "Yes" : "No"}`,
		`Limit: ${userLimit || "Unlimited"} | Bitrate: ${bitrate} kbps`,
	].join("\n");

	const container = new ContainerBuilder()
		.setAccentColor(locked || hidden ? 0xe05252 : 0x57f287)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`## ${name}\n${status}\n\nOnly the channel owner or staff can use these controls.`,
			),
		);

	container.addActionRowComponents(...buildControlRows({ locked, hidden }));
	return container;
}

function buildPanel(hubName = HUB_CHANNEL_NAME) {
	const container = new ContainerBuilder()
		.setAccentColor(0x5865f2)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				"## VoiceMaster\n" +
				`Join **${hubName}** to get your own temporary voice channel.\n` +
				"Use the buttons below to manage the channel you are currently connected to.",
			),
		);

	container.addActionRowComponents(...buildControlRows());
	return container;
}

async function createTempChannel({ client, guild, creator, prisma }) {
	const cfg = await getConfig(prisma, guild.id);
	if (!cfg || !cfg.categoryId) return { error: "VoiceMaster is not set up. Run `vm setup`." };
	if (!cfg.enabled) return { error: "VoiceMaster is disabled." };

	const category = guild.channels.cache.get(cfg.categoryId);
	if (!category) return { error: "The VoiceMaster category no longer exists. Run `vm setup` again." };

	const name = sanitizeChannelName(
		(cfg.defaultName || "{user}'s channel").replaceAll("{user}", creator.displayName),
		`${creator.displayName}'s channel`,
	);
	const bitrate = Math.min(Math.max(Number(cfg.defaultBitrate) || 64, 8), maxBitrateKbps(guild));

	const channel = await guild.channels.create({
		name,
		type: ChannelType.GuildVoice,
		parent: cfg.categoryId,
		bitrate: bitrate * 1000,
		userLimit: 0,
		reason: `VoiceMaster channel for ${creator.user.tag}`,
	}).catch((err) => {
		log.error("Failed to create temp channel: " + err.message);
		return null;
	});

	if (!channel) return { error: "Failed to create the voice channel." };

	const overwrites = [
		{
			id: creator.id,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.Connect,
				PermissionFlagsBits.Speak,
				PermissionFlagsBits.Stream,
				PermissionFlagsBits.ManageChannels,
				PermissionFlagsBits.MoveMembers,
			],
		},
		{
			id: client.user.id,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.Connect,
				PermissionFlagsBits.ManageChannels,
				PermissionFlagsBits.MoveMembers,
				PermissionFlagsBits.ManageRoles,
			],
		},
	];
	if (cfg.defaultRoleId) {
		overwrites.push({
			id: cfg.defaultRoleId,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.Connect,
				PermissionFlagsBits.Speak,
				PermissionFlagsBits.Stream,
			],
		});
	}
	await channel.permissionOverwrites.set(overwrites).catch(() => {});

	if (cfg.defaultRegion && cfg.defaultRegion !== "auto") {
		await channel.setRTCRegion(cfg.defaultRegion).catch(() => {});
	}

	const vc = await prisma.voiceChannel.create({
		data: {
			guildId: guild.id,
			channelId: channel.id,
			ownerId: creator.id,
			bitrate,
			userLimit: 0,
			name,
		},
	});

	if (cfg.interfaceEnabled) {
		const message = await channel.send({
			components: [buildInterface({
				name,
				ownerId: creator.id,
				locked: false,
				hidden: false,
				userLimit: 0,
				bitrate,
			})],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		}).catch((err) => {
			log.warn("Failed to send VoiceMaster interface: " + err.message);
			return null;
		});
		if (message) await message.pin().catch(() => {});
	}

	return { channelId: channel.id, channel, vc };
}

async function findPanelMessage(client, panelChannel) {
	const isPanel = (message) => message?.author?.id === client.user?.id;

	const pinned = await panelChannel.messages.fetchPinned().catch(() => null);
	const fromPinned = pinned?.find(isPanel);
	if (fromPinned) return fromPinned;

	const recent = await panelChannel.messages.fetch({ limit: 50 }).catch(() => null);
	return recent?.find(isPanel) || null;
}

async function setupGuild({ client, guild, prisma, category = null }) {
	await guild.channels.fetch().catch(() => {});

	let cat = category;
	if (cat && cat.type !== ChannelType.GuildCategory) cat = null;

	const cfg = await ensureConfig(prisma, guild.id);
	if (!cat && cfg.categoryId) {
		const configured = guild.channels.cache.get(cfg.categoryId);
		if (configured?.type === ChannelType.GuildCategory) cat = configured;
	}

	if (!cat) {
		cat = guild.channels.cache.find(
			(channel) =>
				channel.type === ChannelType.GuildCategory &&
				channel.name.toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase(),
		);
	}

	if (!cat) {
		cat = await guild.channels.create({
			name: DEFAULT_CATEGORY_NAME,
			type: ChannelType.GuildCategory,
			reason: "VoiceMaster setup",
		});
	}

	let hubChannel = guild.channels.cache.find(
		(channel) =>
			channel.type === ChannelType.GuildVoice &&
			channel.parentId === cat.id &&
			/join\s*to\s*create/i.test(channel.name),
	);

	if (!hubChannel) {
		const existingHubs = await prisma.voiceMasterHub.findMany({ where: { guildId: guild.id } });
		for (const hub of existingHubs) {
			const channel = guild.channels.cache.get(hub.channelId);
			if (channel?.type === ChannelType.GuildVoice && channel.parentId === cat.id) {
				hubChannel = channel;
				break;
			}
		}
	}

	if (!hubChannel) {
		hubChannel = await guild.channels.create({
			name: HUB_CHANNEL_NAME,
			type: ChannelType.GuildVoice,
			parent: cat.id,
			userLimit: 0,
			reason: "VoiceMaster join-to-create hub",
		});
	}

	await prisma.voiceMasterHub.upsert({
		where: { guildId_channelId: { guildId: guild.id, channelId: hubChannel.id } },
		create: { guildId: guild.id, channelId: hubChannel.id, name: hubChannel.name },
		update: { name: hubChannel.name },
	});

	let panelChannel = guild.channels.cache.find(
		(channel) =>
			channel.type === ChannelType.GuildText &&
			channel.parentId === cat.id &&
			(channel.topic === PANEL_TOPIC || channel.name.toLowerCase() === PANEL_CHANNEL_NAME),
	);

	if (!panelChannel) {
		panelChannel = await guild.channels.create({
			name: PANEL_CHANNEL_NAME,
			type: ChannelType.GuildText,
			parent: cat.id,
			topic: PANEL_TOPIC,
			reason: "VoiceMaster control panel",
			permissionOverwrites: [
				{
					id: guild.roles.everyone.id,
					allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
					deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions],
				},
				{
					id: client.user.id,
					allow: [
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.SendMessages,
						PermissionFlagsBits.ManageMessages,
						PermissionFlagsBits.ReadMessageHistory,
					],
				},
			],
		});
	} else {
		if (panelChannel.topic !== PANEL_TOPIC) {
			await panelChannel.setTopic(PANEL_TOPIC).catch(() => {});
		}
		await panelChannel.permissionOverwrites.edit(client.user.id, {
			ViewChannel: true,
			SendMessages: true,
			ManageMessages: true,
			ReadMessageHistory: true,
		}).catch(() => {});
	}

	let panelMessage = await findPanelMessage(client, panelChannel);
	if (panelMessage) {
		try {
			await panelMessage.edit({
				components: [buildPanel(hubChannel.name)],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch {
			panelMessage = null;
		}
	}

	if (!panelMessage) {
		panelMessage = await panelChannel.send({
			components: [buildPanel(hubChannel.name)],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		});
		await panelMessage.pin().catch(() => {});
	}

	await prisma.voiceMasterConfig.update({
		where: { guildId: guild.id },
		data: {
			enabled: true,
			categoryId: cat.id,
			interfaceEnabled: true,
			temporary: true,
		},
	});

	return { category: cat, hubChannel, panelChannel, panelMessage };
}

async function applyPermissions({ client, guild, channel, vc, cfg = null }) {
	const state = {
		locked: Boolean(vc.locked),
		hidden: Boolean(vc.hidden),
	};

	await channel.permissionOverwrites
		.edit(guild.roles.everyone, {
			ViewChannel: state.hidden ? false : null,
			Connect: state.hidden || state.locked ? false : null,
		})
		.catch(() => {});

	if (cfg?.defaultRoleId) {
		await channel.permissionOverwrites
			.edit(cfg.defaultRoleId, {
				ViewChannel: !state.hidden,
				Connect: !state.hidden && !state.locked,
				Speak: !state.hidden,
			})
			.catch(() => {});
	}

	await channel.permissionOverwrites
		.edit(vc.ownerId, {
			ViewChannel: true,
			Connect: true,
			Speak: true,
			ManageChannels: true,
			MoveMembers: true,
		})
		.catch(() => {});

	await channel.permissionOverwrites
		.edit(client.user.id, {
			ViewChannel: true,
			Connect: true,
			Speak: true,
			ManageChannels: true,
			MoveMembers: true,
			ManageRoles: true,
		})
		.catch(() => {});
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

module.exports = {
	PANEL_TOPIC,
	PANEL_CHANNEL_NAME,
	HUB_CHANNEL_NAME,
	getConfig,
	ensureConfig,
	createTempChannel,
	deleteEmptyChannels,
	buildInterface,
	buildPanel,
	applyPermissions,
	setupGuild,
	maxBitrateKbps,
	clampUserLimit,
	sanitizeChannelName,
};
