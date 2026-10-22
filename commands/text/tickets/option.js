const { PermissionsBitField, ButtonStyle } = require("discord.js");
const tickets = require("../../../lib/tickets");
const { buildMessage } = require("../../../lib/v2Reply");

const CUSTOM_EMOJI = /^<a?:[a-zA-Z0-9_]+:\d{17,20}>$/;
const UNICODE_EMOJI =
	/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u200D(?:\p{Extended_Pictographic}|\p{Regional_Indicator})|\p{Regional_Indicator})*$/u;

function isEmoji(value) {
	return CUSTOM_EMOJI.test(value) || UNICODE_EMOJI.test(value);
}

module.exports = {
	commandId: "5db3ec85-f624-417a-b5c0-027891b0685e",
	name: "option",
	parent: "tickets",
	description: "Add, remove, or list ticket category options",
	usage: "tickets option <add|remove|list> [label] [emoji]",
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

		const action = (args[0] || "").toLowerCase();

		if (action === "list") {
			if (!panel.options.length) {
				return message.reply(
					buildMessage(
						"No ticket options. Add one with `tickets option add <label>`.",
						0xe05252,
					),
				);
			}
			const lines = panel.options.map((option) => {
				const roles = (option.supportRoles || [])
					.map((id) => `<@&${id}>`)
					.join(", ");
				return `${option.emoji ? option.emoji + " " : ""}**${option.label}**${
					roles ? ` — ${roles}` : ""
				}`;
			});
			return message.reply(
				buildMessage(`## 🎫 Ticket Options\n${lines.join("\n")}`, 0x5865f2),
			);
		}

		if (action === "remove") {
			const label = args.slice(1).join(" ").trim();
			if (!label) {
				return message.reply(
					buildMessage("Provide the label or name to remove.", 0xe05252),
				);
			}
			const option =
				panel.options.find(
					(item) =>
						item.label.toLowerCase() === label.toLowerCase() ||
						item.name.toLowerCase() === label.toLowerCase(),
				) || null;
			if (!option) {
				return message.reply(
					buildMessage("That ticket option does not exist.", 0xe05252),
				);
			}
			if (panel.options.length <= 1) {
				return message.reply(
					buildMessage("Keep at least one ticket option configured.", 0xe05252),
				);
			}
			await prisma.ticketOption.delete({ where: { id: option.id } });
			const refreshed = await tickets.refreshPanel({
				client: message.client,
				guild,
				prisma,
				panel,
			});
			if (refreshed.error) {
				return message.reply(buildMessage(refreshed.error, 0xe05252));
			}
			return message.reply(
				buildMessage(`Removed option **${option.label}**.`, 0x57f287),
			);
		}

		if (action === "add") {
			const tokens = args.slice(1);
			let label = tokens.join(" ").trim();
			if (!label) {
				return message.reply(
					buildMessage(
						"Provide a label: `tickets option add <label> [emoji]`",
						0xe05252,
					),
				);
			}

			let emoji = "🎫";
			if (tokens.length > 1) {
				const candidate = tokens[tokens.length - 1];
				if (isEmoji(candidate)) {
					emoji = candidate;
					label = tokens.slice(0, -1).join(" ").trim();
				}
			}

			const name =
				label
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-+|-+$/g, "")
					.slice(0, 50) || `option-${Date.now()}`;

			const exists = panel.options.some(
				(option) =>
					option.name === name ||
					option.label.toLowerCase() === label.toLowerCase(),
			);
			if (exists) {
				return message.reply(
					buildMessage("That ticket option already exists.", 0xe05252),
				);
			}

			const supportRoles = [
				...new Set(
					panel.options.flatMap((option) => option.supportRoles || []),
				),
			];
			const fallbackRole = guild.roles.cache.find(
				(role) =>
					!role.managed &&
					role.name.toLowerCase() ===
						tickets.DEFAULT_SUPPORT_ROLE_NAME.toLowerCase(),
			);

			await prisma.ticketOption.create({
				data: {
					panelId: panel.id,
					name,
					label: label.slice(0, 100),
					style: ButtonStyle.Primary,
					emoji: emoji.slice(0, 100),
					categoryId: panel.categoryId,
					supportRoles: supportRoles.length
						? supportRoles
						: fallbackRole
							? [fallbackRole.id]
							: [],
				},
			});

			const refreshed = await tickets.refreshPanel({
				client: message.client,
				guild,
				prisma,
				panel,
			});
			if (refreshed.error) {
				return message.reply(buildMessage(refreshed.error, 0xe05252));
			}
			return message.reply(
				buildMessage(`Option **${label}** added.`, 0x57f287),
			);
		}

		return message.reply(
			buildMessage("Usage: `tickets option <add|remove|list>`", 0xe05252),
		);
	},
};
