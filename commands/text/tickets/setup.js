const { PermissionsBitField, ChannelType } = require("discord.js");
const tickets = require("../../../lib/tickets");
const { buildMessage } = require("../../../lib/v2Reply");
const { getLogger } = require("../../../lib/logger");

const log = getLogger("TicketSetup");

module.exports = {
	commandId: "ce58ab45-29b8-4c24-89d7-c69e9b175d3c",
	name: "setup",
	parent: "tickets",
	description: "Create the ticket category, support role, and panel",
	usage: "tickets setup [category]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],
	requiredBotPermissions: [
		PermissionsBitField.Flags.ManageChannels,
		PermissionsBitField.Flags.ManageRoles,
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ManageMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const raw = args.join(" ").trim();

		let category =
			message.mentions.channels.find(
				(channel) => channel.type === ChannelType.GuildCategory,
			) || null;

		if (!category && raw) {
			const id = args[0].replace(/[<#>]/g, "");
			category =
				guild.channels.cache.get(id) ||
				guild.channels.cache.find(
					(channel) =>
						channel.type === ChannelType.GuildCategory &&
						channel.name.toLowerCase() === raw.toLowerCase(),
				) ||
				null;
			if (!category) {
				return message.reply(
					buildMessage(
						"I couldn't find that category. Mention a category, provide its ID, or run `tickets setup` with no arguments.",
						0xe05252,
					),
				);
			}
		}

		const result = await tickets
			.setupGuild({
				client: message.client,
				guild,
				prisma,
				category,
			})
			.catch((err) => {
				log.error("Ticket setup failed: " + err.message);
				return null;
			});

		if (!result) {
			return message.reply(
				buildMessage(
					"Ticket setup failed. Check that I have **Manage Channels**, **Manage Roles**, **Send Messages**, **Manage Messages**, and **Read Message History**.",
					0xe05252,
				),
			);
		}

		return message.reply(
			buildMessage(
				"## Tickets are ready\n" +
					`**Category:** ${result.category.name}\n` +
					`**Support role:** ${result.supportRole}\n` +
					`**Panel channel:** ${result.panelChannel}\n\n` +
					"Users can open a private ticket from the panel. Use `tickets option` to add more categories.",
				0x57f287,
			),
		);
	},
};
