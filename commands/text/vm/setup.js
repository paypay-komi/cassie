const { PermissionsBitField, ChannelType } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const { getLogger } = require("../../../lib/logger");
const vm = require("../../../lib/voiceMaster");

const log = getLogger("VMSetup");

module.exports = {
	commandId: "5eda3135-d566-4089-b84d-a171cf2f7272",
	name: "setup",
	parent: "vm",
	description: "Create the VoiceMaster hub and control panel",
	usage: "vm setup [category]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],
	requiredBotPermissions: [PermissionsBitField.Flags.ManageChannels],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const raw = args.join(" ").trim();

		let category = message.mentions.channels.find((channel) => channel.type === ChannelType.GuildCategory) || null;
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
				return message.reply(buildMessage("I couldn't find that category. Mention a category, provide its ID, or run `vm setup` with no arguments.", 0xe05252));
			}
		}

		const result = await vm
			.setupGuild({
				client: message.client,
				guild,
				prisma,
				category,
			})
			.catch((err) => {
				log.error("VoiceMaster setup failed: " + err.message);
				return null;
			});

		if (!result) {
			return message.reply(buildMessage("VoiceMaster setup failed. Check that I have **Manage Channels**, **Send Messages**, and **Read Message History**.", 0xe05252));
		}

		return message.reply(
			buildMessage(
				"## VoiceMaster is ready\n" +
				`**Category:** ${result.category}\n` +
				`**Join to create:** ${result.hubChannel}\n` +
				`**Control panel:** ${result.panelChannel}\n\n` +
				"Join the hub voice channel to create your own channel. The panel is pinned in the control panel channel.",
				0x57f287,
			),
		);
	},
};
