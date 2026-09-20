const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	MessageFlags,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
} = require("discord.js");
const tickets = require("../../../lib/tickets");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {
	commandId: "ce58ab45-29b8-4c24-89d7-c69e9b175d3c",
	name: "setup",
	parent: "tickets",
	description: "Send the ticket panel to a channel",
	usage: "tickets setup <#channel>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		const channel = message.mentions.channels.first();
		if (!channel) return message.reply(buildMessage("Mention a channel to send the panel.", 0xe05252));

		const cfg = await tickets.ensureConfig(prisma, guild.id);
		if (!cfg.enabled) {
			return message.reply(buildMessage("Tickets are disabled. Run `tickets config` to enable.", 0xe05252));
		}

		const options = await prisma.ticketOption.findMany({ where: { guildId: guild.id } });

		const container = new ContainerBuilder()
			.setAccentColor(0x5865f2)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent("## 🎫 Support Tickets\nClick below or select a category to open a ticket."),
			);

		if (options.length) {
			container.addSeparatorComponents(new SeparatorBuilder());
			const menu = new StringSelectMenuBuilder()
				.setCustomId("ticket_options")
				.setPlaceholder("Select a category...")
				.addOptions(options.map((o) => ({
					label: o.label,
					description: o.description || undefined,
					emoji: o.emoji || undefined,
					value: o.label,
				})));
			container.addActionRowComponents(new ActionRowBuilder().addComponents(menu));
		}

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId("ticket_create").setLabel("Create Ticket").setStyle(ButtonStyle.Primary).setEmoji("🎫"),
		);
		container.addActionRowComponents(row);

		await channel.send({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		}).catch((err) => {
			return message.reply(buildMessage(`Failed to send panel: ${err.message}`, 0xe05252));
		});

		await prisma.ticketConfig.upsert({
			where: { guildId: guild.id },
			create: { guildId: guild.id, panelChannelId: channel.id },
			update: { panelChannelId: channel.id },
		});

		return message.reply(buildMessage(`Panel sent to ${channel}.`, 0x57f287));
	},
};