const { PermissionsBitField, ChannelType } = require("discord.js");
const tickets = require("../../../lib/tickets");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {
	commandId: "3e1d35ce-7adb-462a-a239-04b166002655",
	name: "config",
	parent: "tickets",
	description: "View or update the default ticket panel",
	usage: "tickets config [max|support|category|refresh] [value]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const panel = await tickets.getPanel(prisma, guild.id);
		if (!panel) {
			return message.reply(
				buildMessage("Tickets are not set up yet. Run `tickets setup`.", 0xe05252),
			);
		}

		const setting = (args[0] || "").toLowerCase();
		const value = args.slice(1).join(" ");
		const channel = panel.channelId
			? guild.channels.cache.get(panel.channelId)
			: null;
		const category = panel.categoryId
			? guild.channels.cache.get(panel.categoryId)
			: null;
		const supportRoles = [
			...new Set(panel.options.flatMap((option) => option.supportRoles || [])),
		];

		if (!setting) {
			const lines = [
				`**Panel:** ${panel.name}`,
				`**Channel:** ${channel ? `${channel}` : "Not posted"}`,
				`**Category:** ${category ? `${category}` : "Not set"}`,
				`**Max open:** ${panel.maxOpen > 0 ? panel.maxOpen : "Unlimited"}`,
				`**Support roles:** ${
					supportRoles.length
						? supportRoles.map((id) => `<@&${id}>`).join(", ")
						: "Not set"
				}`,
				`**Options:** ${panel.options.length}`,
			];
			return message.reply(
				buildMessage("## 🎫 Ticket Config\n" + lines.join("\n"), 0x5865f2),
			);
		}

		if (setting === "refresh") {
			const result = await tickets.refreshPanel({
				client: message.client,
				guild,
				prisma,
				panel,
			});
			if (result.error) {
				return message.reply(buildMessage(result.error, 0xe05252));
			}
			return message.reply(
				buildMessage(`Ticket panel refreshed in ${result.channel}.`, 0x57f287),
			);
		}

		if (setting === "max") {
			const maxOpen = Number.parseInt(value, 10);
			if (!Number.isFinite(maxOpen) || maxOpen < 0) {
				return message.reply(
					buildMessage("Provide a number of open tickets (0 for unlimited).", 0xe05252),
				);
			}
			await prisma.ticketPanel.update({
				where: { id: panel.id },
				data: { maxOpen },
			});
			return message.reply(
				buildMessage(
					`Max open tickets set to **${maxOpen || "unlimited"}**.`,
					0x57f287,
				),
			);
		}

		if (setting === "support") {
			const role =
				message.mentions.roles.first() ||
				(value && /^\d+$/.test(value) ? guild.roles.cache.get(value) : null);
			if (!role) {
				return message.reply(
					buildMessage("Mention a role or provide a role ID.", 0xe05252),
				);
			}
			await prisma.ticketOption.updateMany({
				where: { panelId: panel.id },
				data: { supportRoles: [role.id] },
			});
			return message.reply(
				buildMessage(`Support role set to ${role}.`, 0x57f287),
			);
		}

		if (setting === "category") {
			const target =
				message.mentions.channels.find(
					(item) => item.type === ChannelType.GuildCategory,
				) ||
				(value && /^\d+$/.test(value)
					? guild.channels.cache.get(value)
					: null);
			if (!target || target.type !== ChannelType.GuildCategory) {
				return message.reply(
					buildMessage("Mention a category or provide a category ID.", 0xe05252),
				);
			}
			await prisma.ticketPanel.update({
				where: { id: panel.id },
				data: { categoryId: target.id },
			});
			await prisma.ticketOption.updateMany({
				where: { panelId: panel.id },
				data: { categoryId: target.id },
			});
			if (channel) {
				await channel
					.setParent(target.id, { lockPermissions: false })
					.catch(() => {});
			}
			return message.reply(
				buildMessage(`Ticket category set to ${target}.`, 0x57f287),
			);
		}

		return message.reply(
			buildMessage(
				"Options: `max`, `support`, `category`, `refresh`",
				0xe05252,
			),
		);
	},
};
