const {
	PermissionFlagsBits,
	ChannelType,
	MessageFlags,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
	ContainerBuilder,
	TextDisplayBuilder,
} = require("discord.js");
const { getLogger } = require("./logger");
const { buildMessage } = require("./v2Reply");

const log = getLogger("Tickets");

const DEFAULT_CATEGORY_NAME = "Tickets";
const DEFAULT_PANEL_NAME = "Support";
const DEFAULT_PANEL_CHANNEL_NAME = "open-a-ticket";
const DEFAULT_OPTION_NAME = "general";
const DEFAULT_OPTION_LABEL = "General Support";
const DEFAULT_SUPPORT_ROLE_NAME = "Support Team";
const PANEL_TOPIC = "Ticket support panel";
const ACTIVE_STATUSES = ["open", "claimed"];

function buttonStyle(style) {
	switch (Number(style)) {
		case ButtonStyle.Secondary:
			return ButtonStyle.Secondary;
		case ButtonStyle.Success:
			return ButtonStyle.Success;
		case ButtonStyle.Danger:
			return ButtonStyle.Danger;
		default:
			return ButtonStyle.Primary;
	}
}

function buildPanel(panel, options = []) {
	const container = new ContainerBuilder()
		.setAccentColor(0x5865f2)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`## ${panel.name || DEFAULT_PANEL_NAME} Tickets\n` +
					"Open a private ticket below and a member of our support team will assist you.",
			),
		);

	if (!options.length) {
		return container;
	}

	if (options.length === 1) {
		const option = options[0];
		const button = new ButtonBuilder()
			.setCustomId(`ticket:open:${panel.id}:${option.id}`)
			.setLabel(option.label || DEFAULT_OPTION_LABEL)
			.setStyle(buttonStyle(option.style));
		if (option.emoji) button.setEmoji(option.emoji);
		container.addActionRowComponents(new ActionRowBuilder().addComponents(button));
		return container;
	}

	const menu = new StringSelectMenuBuilder()
		.setCustomId(`ticket:select:${panel.id}`)
		.setPlaceholder("Choose a ticket category...")
		.setMinValues(1)
		.setMaxValues(1)
		.addOptions(
			options.slice(0, 25).map((option) => {
				const item = {
					label: String(option.label || option.name || DEFAULT_OPTION_LABEL).slice(0, 100),
					value: option.id,
				};
				if (option.emoji) item.emoji = option.emoji;
				return item;
			}),
		);

	container.addActionRowComponents(
		new ActionRowBuilder().addComponents(menu),
	);
	return container;
}

function panelPayload(panel, options = []) {
	return {
		components: [buildPanel(panel, options)],
		flags: MessageFlags.IsComponentsV2,
		allowedMentions: { parse: [] },
	};
}

async function getPanel(prisma, guildId, name = DEFAULT_PANEL_NAME) {
	return prisma.ticketPanel
		.findUnique({
			where: { guildId_name: { guildId, name } },
			include: { options: true },
		})
		.catch(() => null);
}

async function getPanelById(prisma, guildId, panelId) {
	return prisma.ticketPanel.findFirst({
		where: { id: panelId, guildId },
		include: { options: true },
	});
}

async function getTicketForChannel(prisma, guildId, channelId) {
	return prisma.ticket.findFirst({
		where: {
			guildId,
			channelId,
			status: { in: ACTIVE_STATUSES },
		},
	});
}

async function ensureSupportRole(guild) {
	let role = guild.roles.cache.find(
		(item) =>
			!item.managed &&
			item.name.toLowerCase() === DEFAULT_SUPPORT_ROLE_NAME.toLowerCase(),
	);
	if (role) return role;

	role = await guild.roles.create({
		name: DEFAULT_SUPPORT_ROLE_NAME,
		color: 0x5865f2,
		mentionable: true,
		permissions: 0n,
		reason: "Ticket system setup",
	});
	return role;
}

async function applyPanelPermissions({ client, guild, channel, supportRole }) {
	const everyone = guild.roles.everyone;
	await channel.permissionOverwrites
		.edit(everyone, {
			ViewChannel: true,
			ReadMessageHistory: true,
			SendMessages: false,
			AddReactions: false,
			CreatePublicThreads: false,
			CreatePrivateThreads: false,
			SendMessagesInThreads: false,
		})
		.catch(() => {});

	await channel.permissionOverwrites
		.edit(client.user.id, {
			ViewChannel: true,
			SendMessages: true,
			ReadMessageHistory: true,
			ManageMessages: true,
		})
		.catch(() => {});

	if (supportRole) {
		await channel.permissionOverwrites
			.edit(supportRole.id, {
				ViewChannel: true,
				ReadMessageHistory: true,
				SendMessages: false,
			})
			.catch(() => {});
	}
}

async function resolvePanelChannel({ guild, panel }) {
	if (panel.channelId) {
		const cached = guild.channels.cache.get(panel.channelId);
		if (cached?.type === ChannelType.GuildText) return cached;
		const fetched = await guild.channels.fetch(panel.channelId).catch(() => null);
		if (fetched?.type === ChannelType.GuildText) return fetched;
	}
	return null;
}

async function findPanelMessage({ client, channel, panel }) {
	if (panel.messageId) {
		const message = await channel.messages.fetch(panel.messageId).catch(() => null);
		if (message) return message;
	}

	const pinned = await channel.messages.fetchPinned().catch(() => null);
	if (!pinned) return null;

	for (const message of pinned.values()) {
		if (message.author?.id === client.user.id && message.components?.length) {
			return message;
		}
	}
	return null;
}

async function refreshPanel({ client, guild, prisma, panel, panelChannel = null }) {
	const freshPanel =
		(await prisma.ticketPanel.findUnique({
			where: { id: panel.id },
			include: { options: true },
		})) || panel;
	const channel = panelChannel || (await resolvePanelChannel({ guild, panel: freshPanel }));
	if (!channel) return { error: "Panel channel not found." };

	let message = await findPanelMessage({ client, channel, panel: freshPanel });
	if (message) {
		await message
			.edit(panelPayload(freshPanel, freshPanel.options))
			.catch(() => {
				message = null;
			});
	}

	if (!message) {
		message = await channel.send(panelPayload(freshPanel, freshPanel.options));
		await message.pin().catch(() => {});
	}

	await prisma.ticketPanel.update({
		where: { id: freshPanel.id },
		data: { channelId: channel.id, messageId: message.id },
	});

	return { message, channel, panel: freshPanel };
}

async function setupGuild({ client, guild, prisma, category = null }) {
	await guild.channels.fetch().catch(() => {});

	const existingPanel = await getPanel(prisma, guild.id, DEFAULT_PANEL_NAME);
	let cat = category;
	if (cat && cat.type !== ChannelType.GuildCategory) cat = null;

	if (!cat && existingPanel?.categoryId) {
		const configured = guild.channels.cache.get(existingPanel.categoryId);
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
			reason: "Ticket system setup",
		});
	}

	const supportRole = await ensureSupportRole(guild);

	const panel = await prisma.ticketPanel.upsert({
		where: {
			guildId_name: { guildId: guild.id, name: DEFAULT_PANEL_NAME },
		},
		create: {
			guildId: guild.id,
			name: DEFAULT_PANEL_NAME,
			categoryId: cat.id,
			mode: "channel",
			maxOpen: 1,
		},
		update: {
			categoryId: cat.id,
			mode: "channel",
		},
	});

	const option = await prisma.ticketOption.upsert({
		where: {
			panelId_name: { panelId: panel.id, name: DEFAULT_OPTION_NAME },
		},
		create: {
			panelId: panel.id,
			name: DEFAULT_OPTION_NAME,
			label: DEFAULT_OPTION_LABEL,
			style: ButtonStyle.Primary,
			emoji: "\u{1F3AB}",
			categoryId: cat.id,
			supportRoles: [supportRole.id],
		},
		update: {
			categoryId: cat.id,
			supportRoles: [supportRole.id],
		},
	});

	let panelChannel = await resolvePanelChannel({ guild, panel });
	if (!panelChannel) {
		panelChannel = guild.channels.cache.find(
			(channel) =>
				channel.type === ChannelType.GuildText &&
				channel.parentId === cat.id &&
				(channel.topic === PANEL_TOPIC ||
					channel.name.toLowerCase() === DEFAULT_PANEL_CHANNEL_NAME),
		);
	}

	if (!panelChannel) {
		panelChannel = await guild.channels.create({
			name: DEFAULT_PANEL_CHANNEL_NAME,
			type: ChannelType.GuildText,
			parent: cat.id,
			topic: PANEL_TOPIC,
			reason: "Ticket support panel",
		});
	} else {
		if (panelChannel.topic !== PANEL_TOPIC) {
			await panelChannel.setTopic(PANEL_TOPIC).catch(() => {});
		}
		if (panelChannel.parentId !== cat.id) {
			await panelChannel.setParent(cat.id, { lockPermissions: false }).catch(() => {});
		}
	}

	await applyPanelPermissions({ client, guild, channel: panelChannel, supportRole });
	const refreshed = await refreshPanel({
		client,
		guild,
		prisma,
		panel: { ...panel, channelId: panelChannel.id },
		panelChannel,
	});
	if (refreshed?.error) throw new Error(refreshed.error);

	return {
		category: cat,
		supportRole,
		panel: refreshed.panel,
		option,
		panelChannel,
		panelMessage: refreshed.message,
	};
}

function memberHasSupportRole(member, supportRoleIds) {
	if (!member?.roles?.cache || !supportRoleIds?.length) return false;
	return supportRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

function canManageTicket({ member, ticket, option }) {
	if (!member || !ticket) return false;
	if (ticket.ownerId === member.id) return true;
	if (
		member.permissions?.has(PermissionFlagsBits.Administrator) ||
		member.permissions?.has(PermissionFlagsBits.ManageChannels) ||
		member.permissions?.has(PermissionFlagsBits.ManageMessages)
	) {
		return true;
	}
	return memberHasSupportRole(member, option?.supportRoles || []);
}

async function createTicket({ client, guild, creator, prisma, panelId, optionId, formData = null }) {
	const panel = await getPanelById(prisma, guild.id, panelId);
	if (!panel) return { error: "Ticket panel not found. Run `tickets setup`." };

	const option = optionId
		? panel.options.find((item) => item.id === optionId)
		: panel.options[0];
	if (!option) return { error: "No ticket options are configured. Run `tickets setup`." };

	const existing = await prisma.ticket.findFirst({
		where: {
			guildId: guild.id,
			panelId: panel.id,
			ownerId: creator.id,
			status: { in: ACTIVE_STATUSES },
		},
	});
	if (existing) {
		return {
			error: `You already have an open ticket: <#${existing.channelId}>`,
			channelId: existing.channelId,
		};
	}

	const openCount = await prisma.ticket.count({
		where: {
			guildId: guild.id,
			panelId: panel.id,
			ownerId: creator.id,
			status: { in: ACTIVE_STATUSES },
		},
	});
	if (panel.maxOpen > 0 && openCount >= panel.maxOpen) {
		return {
			error: `You already have ${openCount} open ticket(s). Close one before opening another.`,
		};
	}

	const supportRoleIds = (option.supportRoles || []).filter((roleId) =>
		guild.roles.cache.has(roleId),
	);
	const parentId = option.categoryId || panel.categoryId;
	const parent = parentId ? guild.channels.cache.get(parentId) : null;
	const ticketNumber = (await prisma.ticket.count({ where: { guildId: guild.id } })) + 1;
	const cleanUsername = String(creator.username || "user")
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.slice(0, 60) || "user";

	const channel = await guild.channels
		.create({
			name: `ticket-${ticketNumber}-${cleanUsername}`.slice(0, 100),
			type: ChannelType.GuildText,
			parent: parent?.type === ChannelType.GuildCategory ? parent.id : null,
			topic: `Ticket #${ticketNumber} for ${creator.username || creator.id}`,
			reason: `Ticket opened by ${creator.username || creator.id}`,
			permissionOverwrites: [
				{
					id: guild.roles.everyone.id,
					deny: [PermissionFlagsBits.ViewChannel],
				},
				{
					id: creator.id,
					allow: [
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.SendMessages,
						PermissionFlagsBits.ReadMessageHistory,
						PermissionFlagsBits.AttachFiles,
						PermissionFlagsBits.EmbedLinks,
					],
				},
				...supportRoleIds.map((roleId) => ({
					id: roleId,
					allow: [
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.SendMessages,
						PermissionFlagsBits.ReadMessageHistory,
						PermissionFlagsBits.ManageMessages,
					],
				})),
				{
					id: client.user.id,
					allow: [
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.SendMessages,
						PermissionFlagsBits.ReadMessageHistory,
						PermissionFlagsBits.ManageChannels,
						PermissionFlagsBits.ManageMessages,
						PermissionFlagsBits.AttachFiles,
						PermissionFlagsBits.EmbedLinks,
					],
				},
			],
		})
		.catch((err) => {
			log.error(`Failed to create ticket channel: ${err.message}`);
			return null;
		});

	if (!channel) return { error: "Failed to create the ticket channel." };

	let ticket;
	try {
		ticket = await prisma.ticket.create({
			data: {
				guildId: guild.id,
				panelId: panel.id,
				optionId: option.id,
				channelId: channel.id,
				ownerId: creator.id,
				status: "open",
				subject: option.label,
				formData: formData || undefined,
			},
		});
	} catch (err) {
		log.error(`Failed to save ticket: ${err.message}`);
		await channel.delete().catch(() => {});
		return { error: "Failed to save the ticket." };
	}

	const supportMentions = supportRoleIds.map((roleId) => `<@&${roleId}>`).join(" ");
	const answerLines = Array.isArray(formData)
		? formData
				.filter((field) => field?.value)
				.map((field) => `**${field.label}:** ${field.value}`)
		: [];
	const container = new ContainerBuilder()
		.setAccentColor(0x5865f2)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`## Ticket #${ticketNumber}\n` +
					`**Category:** ${option.label}\n` +
					`**Opened by:** ${creator.username || creator.id}\n\n` +
					(supportMentions
						? `${supportMentions} will be with you shortly.`
						: "Support will be with you shortly.") +
					(answerLines.length
						? `\n\n**Request details**\n${answerLines.join("\n")}`.slice(0, 1800)
						: ""),
			),
		)
		.addActionRowComponents(
			new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`ticket:claim:${ticket.id}`)
					.setLabel("Claim")
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId(`ticket:close:${ticket.id}`)
					.setLabel("Close")
					.setStyle(ButtonStyle.Danger),
			),
		);

	await channel
		.send({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { roles: supportRoleIds },
		})
		.catch(() => {});

	return {
		channelId: channel.id,
		ticketId: ticket.id,
		ticketNumber,
		optionLabel: option.label,
	};
}

async function claimTicket({ client, guild, prisma, ticketId, claimer }) {
	const ticket = await prisma.ticket.findFirst({
		where: { id: ticketId, guildId: guild.id },
	});
	if (!ticket) return { error: "Ticket not found." };
	if (ticket.status === "closed") return { error: "This ticket is already closed." };

	const updated = await prisma.ticket.update({
		where: { id: ticket.id },
		data: { status: "claimed", claimedById: claimer.id },
	});

	const channel = guild.channels.cache.get(ticket.channelId);
	if (channel) {
		await channel
			.send(buildMessage(`🎫 Ticket claimed by <@${claimer.id}>.`, 0x57f287))
			.catch(() => {});
	}

	return { ticket: updated };
}

async function closeTicket({ client, guild, prisma, ticketId, channelId, closedBy, reason }) {
	const ticket = ticketId
		? await prisma.ticket.findFirst({
				where: { id: ticketId, guildId: guild.id },
			})
		: await getTicketForChannel(prisma, guild.id, channelId);

	if (!ticket) return { error: "Ticket not found." };
	if (ticket.status === "closed") return { error: "Ticket is already closed." };

	const updated = await prisma.ticket.update({
		where: { id: ticket.id },
		data: {
			status: "closed",
			closedAt: new Date(),
			closedById: closedBy,
			closeReason: reason || null,
		},
	});

	const channel =
		guild.channels.cache.get(ticket.channelId) ||
		(await guild.channels.fetch(ticket.channelId).catch(() => null));

	if (channel) {
		await channel
			.send(
				buildMessage(
					`🔒 Ticket closed by <@${closedBy}>${reason ? ` — ${reason}` : ""}.`,
					0xe05252,
				),
			)
			.catch(() => {});

		if (channel.isThread?.()) {
			await channel.setLocked(true).catch(() => {});
			await channel.setArchived(true).catch(() => {});
		} else {
			await channel.permissionOverwrites
				.edit(ticket.ownerId, {
					ViewChannel: false,
					SendMessages: false,
				})
				.catch(() => {});
			if (closedBy !== ticket.ownerId) {
				await channel.permissionOverwrites
					.edit(closedBy, {
						ViewChannel: true,
						SendMessages: true,
						ReadMessageHistory: true,
					})
					.catch(() => {});
			}
		}
	}

	return { success: true, ticket: updated };
}

async function generateTranscript(guild, channelId) {
	const channel = guild.channels.cache.get(channelId);
	if (!channel || !channel.isTextBased()) {
		return { error: "Channel not found or not text-based." };
	}

	const messages = [];
	let lastId;
	while (true) {
		const fetchOptions = { limit: 100 };
		if (lastId) fetchOptions.before = lastId;
		const batch = await channel.messages.fetch(fetchOptions).catch(() => new Map());
		const arr = [...batch.values()];
		if (!arr.length) break;
		messages.push(...arr);
		lastId = arr[arr.length - 1].id;
		if (arr.length < 100) break;
	}

	const lines = messages.reverse().map((message) => {
		const time = `<t:${Math.floor(message.createdTimestamp / 1000)}:f>`;
		return `[${time}] ${message.author.tag}: ${message.content}${
			message.attachments.size ? ` [${message.attachments.size} attachment(s)]` : ""
		}`;
	});

	return { transcript: lines.join("\n"), messageCount: messages.length };
}

module.exports = {
	DEFAULT_CATEGORY_NAME,
	DEFAULT_PANEL_NAME,
	DEFAULT_PANEL_CHANNEL_NAME,
	DEFAULT_OPTION_NAME,
	DEFAULT_OPTION_LABEL,
	DEFAULT_SUPPORT_ROLE_NAME,
	PANEL_TOPIC,
	buildPanel,
	panelPayload,
	getPanel,
	getPanelById,
	getTicketForChannel,
	setupGuild,
	refreshPanel,
	createTicket,
	claimTicket,
	closeTicket,
	generateTranscript,
	memberHasSupportRole,
	canManageTicket,
};
