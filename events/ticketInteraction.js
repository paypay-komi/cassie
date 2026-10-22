const {
	Events,
	PermissionFlagsBits,
	ActionRowBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require("discord.js");
const { getLogger } = require("../lib/logger");
const tickets = require("../lib/tickets");
const { buildMessage } = require("../lib/v2Reply");

const log = getLogger("TicketEvents");
const MAX_MODAL_FIELDS = 5;

async function respond(interaction, text, color = 0xe05252) {
	const payload = {
		...buildMessage(text, color),
		ephemeral: true,
	};
	if (interaction.deferred || interaction.replied) {
		return interaction.editReply(buildMessage(text, color)).catch(() => {});
	}
	return interaction.reply(payload).catch(() => {});
}

function supportMember(member, option) {
	if (!member) return false;
	if (
		member.permissions?.has(PermissionFlagsBits.Administrator) ||
		member.permissions?.has(PermissionFlagsBits.ManageChannels) ||
		member.permissions?.has(PermissionFlagsBits.ManageMessages)
	) {
		return true;
	}
	return tickets.memberHasSupportRole(member, option?.supportRoles || []);
}

async function getForm(prisma, option) {
	if (!option?.formId) return null;
	return prisma.ticketForm.findUnique({
		where: { id: option.formId },
		include: { fields: { orderBy: { order: "asc" } } },
	});
}

async function createAndReply(client, interaction, panelId, optionId, formData = null) {
	await interaction.deferReply({ ephemeral: true });
	const result = await tickets.createTicket({
		client,
		guild: interaction.guild,
		creator: interaction.user,
		prisma: client.db.prisma,
		panelId,
		optionId,
		formData,
	});

	if (result.error) return respond(interaction, result.error);
	return respond(
		interaction,
		`Ticket #${result.ticketNumber} created in <#${result.channelId}>\nCategory: **${result.optionLabel}**`,
		0x57f287,
	);
}

async function openTicket(client, interaction, panelId, optionId) {
	const prisma = client.db.prisma;
	const panel = await tickets.getPanelById(prisma, interaction.guild.id, panelId);
	if (!panel) return respond(interaction, "Ticket panel not found. Run `tickets setup`.");

	const option = panel.options.find((item) => item.id === optionId);
	if (!option) return respond(interaction, "Ticket option not found. Ask staff to refresh the panel.");

	const form = await getForm(prisma, option);
	const fields = (form?.fields || []).slice(0, MAX_MODAL_FIELDS);
	if (!fields.length) {
		return createAndReply(client, interaction, panelId, optionId);
	}

	const modal = new ModalBuilder()
		.setCustomId(`ticket:form:${panel.id}:${option.id}`)
		.setTitle(String(form.title || "Support Request").slice(0, 45));

	modal.addComponents(
		fields.map((field) =>
			new ActionRowBuilder().addComponents(
				new TextInputBuilder()
					.setCustomId(field.key)
					.setLabel(String(field.label).slice(0, 45))
					.setStyle(
						field.type === "long_text"
							? TextInputStyle.Paragraph
							: TextInputStyle.Short,
					)
					.setRequired(field.required !== false)
					.setMaxLength(1000),
			),
		),
	);

	return interaction.showModal(modal).catch((err) => {
		log.error("Failed to show ticket form: " + err.message);
	});
}

module.exports = {
	name: Events.InteractionCreate,
	description: "Handles ticket panels, forms, and in-ticket buttons",

	async execute(client, interaction) {
		if (!interaction.guild) return;

		const prisma = client.db.prisma;
		const guild = interaction.guild;
		const customId = interaction.customId || "";

		if (interaction.isButton() && customId.startsWith("ticket:open:")) {
			const [, , panelId, optionId] = customId.split(":");
			return openTicket(client, interaction, panelId, optionId);
		}

		if (interaction.isStringSelectMenu() && customId.startsWith("ticket:select:")) {
			const panelId = customId.split(":")[2];
			const optionId = interaction.values[0];
			return openTicket(client, interaction, panelId, optionId);
		}

		if (interaction.isModalSubmit() && customId.startsWith("ticket:form:")) {
			const [, , panelId, optionId] = customId.split(":");
			const panel = await tickets.getPanelById(prisma, guild.id, panelId);
			const option = panel?.options.find((item) => item.id === optionId);
			if (!panel || !option) {
				return respond(interaction, "This ticket form is no longer available.");
			}

			const form = await getForm(prisma, option);
			const formData = (form?.fields || []).slice(0, MAX_MODAL_FIELDS).map((field) => {
				let value = "";
				try {
					value = interaction.fields.getTextInputValue(field.key);
				} catch {}
				return { key: field.key, label: field.label, value };
			});
			return createAndReply(client, interaction, panelId, optionId, formData);
		}

		if (interaction.isButton() && customId.startsWith("ticket:claim:")) {
			const ticketId = customId.split(":")[2];
			const ticket = await prisma.ticket.findFirst({
				where: { id: ticketId, guildId: guild.id },
				include: { option: true },
			});
			if (!ticket) return respond(interaction, "Ticket not found.");
			if (!supportMember(interaction.member, ticket.option)) {
				return respond(interaction, "Only support staff can claim tickets.");
			}
			await interaction.deferReply({ ephemeral: true });
			const result = await tickets.claimTicket({
				client,
				guild,
				prisma,
				ticketId,
				claimer: interaction.user,
			});
			if (result.error) return respond(interaction, result.error);
			return respond(interaction, "Ticket claimed.", 0x57f287);
		}

		if (interaction.isButton() && customId.startsWith("ticket:close:")) {
			const ticketId = customId.split(":")[2];
			const ticket = await prisma.ticket.findFirst({
				where: { id: ticketId, guildId: guild.id },
				include: { option: true },
			});
			if (!ticket) return respond(interaction, "Ticket not found.");
			if (
				!tickets.canManageTicket({
					member: interaction.member,
					ticket,
					option: ticket.option,
				})
			) {
				return respond(interaction, "You cannot close this ticket.");
			}
			await interaction.deferReply({ ephemeral: true });
			const result = await tickets.closeTicket({
				client,
				guild,
				prisma,
				ticketId,
				closedBy: interaction.user.id,
				reason: "Closed from ticket panel",
			});
			if (result.error) return respond(interaction, result.error);
			return respond(interaction, "Ticket closed.", 0xe05252);
		}
	},
};
