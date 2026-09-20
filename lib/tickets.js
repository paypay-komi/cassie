const { PermissionFlagsBits, ChannelType, TextChannel } = require("discord.js");
const { getLogger } = require("./logger");

const log = getLogger("Tickets");

async function getConfig(prisma, guildId) {
	return prisma.ticketConfig.findUnique({ where: { guildId } });
}

async function ensureConfig(prisma, guildId) {
	return prisma.ticketConfig.upsert({
		where: { guildId },
		create: { guildId },
		update: {},
	});
}

async function createTicket({ client, guild, creator, formAnswers, prisma }) {
	const cfg = await getConfig(prisma, guild.id);
	if (!cfg || !cfg.enabled) return { error: "Tickets are not enabled." };
	if (!cfg.categoryChannelId) return { error: "Ticket category not configured." };
	if (!cfg.supportRoleId) return { error: "Support role not configured." };

	const openCount = await prisma.ticket.count({
		where: { guildId: guild.id, creatorId: creator.id, status: "open" },
	});
	if (cfg.maxOpen && openCount >= cfg.maxOpen) {
		return { error: `You already have ${openCount} open ticket(s). Close one first.` };
	}

	const existing = await prisma.ticket.findFirst({
		where: { guildId: guild.id, creatorId: creator.id, status: "open" },
	});
	if (existing) {
		return { error: "You already have an open ticket.", channelId: existing.channelId };
	}

	const options = await prisma.ticketOption.findMany({ where: { guildId: guild.id } });
	const forms = await prisma.ticketForm.findMany({ where: { guildId: guild.id } });
	const ticketNumber = (await prisma.ticket.count({ where: { guildId: guild.id } })) + 1;

	const supportRole = guild.roles.cache.get(cfg.supportRoleId);
	if (!supportRole) return { error: "Support role not found." };

	const channel = await guild.channels.create({
		name: `ticket-${ticketNumber}-${creator.username}`.slice(0, 100),
		type: ChannelType.GuildText,
		parent: cfg.categoryChannelId || null,
		permissionOverwrites: [
			{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
			{ id: creator.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
			{ id: cfg.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
			{ id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] },
		],
	}).catch((err) => { log.error(`Failed to create ticket channel: ${err.message}`); return null; });

	if (!channel) return { error: "Failed to create the ticket channel." };

	const ticket = await prisma.ticket.create({
		data: { guildId: guild.id, channelId: channel.id, creatorId: creator.id, status: "open" },
	});

	const lines = [
		`## Ticket #${ticketNumber}`,
		`Welcome ${creator}, support will be with you shortly.`,
	];
	if (forms.length) {
		lines.push("", "**Questions:**");
		forms.forEach((f, i) => lines.push(`${i + 1}. ${f.question}${f.required ? " *(required)*" : ""}`));
	}
	if (formAnswers && formAnswers.length) {
		lines.push("", "**Your answers:**");
		forms.forEach((f, i) => {
			if (formAnswers[i]) lines.push(`**${f.question}** ${formAnswers[i]}`);
		});
	}

	const { buildMessage } = require("./v2Reply");
	await channel.send({ ...buildMessage(lines.join("\n"), 0x5865f2), allowedMentions: { parse: ["users"] } }).catch(() => {});

		if (cfg.logChannelId) {
		const logCh = guild.channels.cache.get(cfg.logChannelId);
		if (logCh && logCh.isTextBased()) {
			await logCh.send(buildMessage(`📩 Ticket #${ticketNumber} opened by ${creator}`, 0x5865f2)).catch(() => {});
		}
	}

	return { channelId: channel.id, ticketNumber };
}

async function closeTicket({ client, guild, channelId, closedBy, prisma, reason }) {
	const ticket = await prisma.ticket.findUnique({
		where: { guildId_channelId: { guildId: guild.id, channelId } },
	});
	if (!ticket) return { error: "Ticket not found." };
	if (ticket.status === "closed") return { error: "Ticket is already closed." };

	await prisma.ticket.update({
		where: { guildId_channelId: { guildId: guild.id, channelId } },
		data: { status: "closed", closedAt: new Date(), closedBy },
	});

	const cfg = await getConfig(prisma, guild.id);
	const channel = guild.channels.cache.get(channelId);

	if (channel) {
		const { buildMessage } = require("./v2Reply");
		await channel.send(buildMessage(`🔒 Ticket closed by <@${closedBy}>${reason ? ` — ${reason}` : ""}. Transcript will be saved.`, 0xe05252)).catch(() => {});

			if (cfg?.logChannelId) {
			const logCh = guild.channels.cache.get(cfg.logChannelId);
			if (logCh && logCh.isTextBased()) {
				await logCh.send(buildMessage(`🔒 Ticket #${ticket.channelId} closed by <@${closedBy}>${reason ? ` — ${reason}` : ""}.`, 0xe05252)).catch(() => {});
			}
		}

		await channel.setPermissionOverwrites([
			{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
			{ id: closedBy, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
			{ id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] },
		]).catch(() => {});
	}

	return { success: true, ticket };
}

async function generateTranscript(guild, channelId) {
	const channel = guild.channels.cache.get(channelId);
	if (!channel || !channel.isTextBased()) return { error: "Channel not found or not text-based." };

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

	const lines = messages.reverse().map((m) => {
		const time = `<t:${Math.floor(m.createdTimestamp / 1000)}:f>`;
		return `[${time}] ${m.author.tag}: ${m.content}${m.attachments.size ? ` [${m.attachments.size} attachment(s)]` : ""}`;
	});

	return { transcript: lines.join("\n"), messageCount: messages.length };
}

module.exports = { getConfig, ensureConfig, createTicket, closeTicket, generateTranscript };