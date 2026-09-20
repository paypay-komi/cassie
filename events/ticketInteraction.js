const { PermissionFlagsBits, ChannelType, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getLogger } = require("../lib/logger");
const tickets = require("../lib/tickets");
const { buildMessage } = require("../lib/v2Reply");

const log = getLogger("TicketEvents");

module.exports = {
	name: "ticketInteraction",
	description: "Handles ticket panel and in-ticket button interactions",

	async execute(client, interaction) {
		if (!interaction.isButton() && !interaction.isStringSelect()) return;
		if (!interaction.guild) return;

		const { customId } = interaction;
		const guild = interaction.guild;
		const prisma = client.db.prisma;

		// Panel "Create Ticket" button
		if (customId === "ticket_create") {
			await interaction.deferReply({ ephemeral: true });

			const cfg = await tickets.getConfig(prisma, guild.id);
			if (!cfg || !cfg.enabled) {
				return interaction.editReply(buildMessage("Tickets are currently disabled.", 0xe05252));
			}

			const result = await tickets.createTicket({ client, guild, creator: interaction.user, prisma });
			if (result.error) {
				return interaction.editReply(buildMessage(result.error, 0xe05252));
			}

			return interaction.editReply(buildMessage(`Ticket created! <#${result.channelId}>`, 0x57f287));
		}

		// Panel select menu — user picks a category
		if (customId === "ticket_options") {
			await interaction.deferReply({ ephemeral: true });

			const optionLabel = interaction.values[0];
			const options = await prisma.ticketOption.findMany({ where: { guildId: guild.id } });
			const option = options.find((o) => o.label === optionLabel);
			if (!option) {
				return interaction.editReply(buildMessage("That option no longer exists.", 0xe05252));
			}

			const result = await tickets.createTicket({ client, guild, creator: interaction.user, prisma });
			if (result.error) {
				return interaction.editReply(buildMessage(result.error, 0xe05252));
			}

			// Move to assigned category if set
			if (option.channelId) {
				const ch = guild.channels.cache.get(result.channelId);
				if (ch) await ch.setParent(option.channelId, { lockPermissions: false }).catch(() => {});
			}

			return interaction.editReply(buildMessage(`Ticket #${result.ticketNumber} created! <#${result.channelId}>\nCategory: **${option.label}**`, 0x57f287));
		}

		// In-ticket close button
		if (customId.startsWith("ticket_close_")) {
			const channelId = customId.replace("ticket_close_", "");
			await interaction.deferReply({ ephemeral: true });

			const result = await tickets.closeTicket({ client, guild, channelId, closedBy: interaction.user.id, prisma });
			if (result.error) {
				return interaction.editReply(buildMessage(result.error, 0xe05252));
			}

			return interaction.editReply(buildMessage("Ticket closed.", 0xe05252));
		}
	},
};