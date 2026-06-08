const { getLogger } = require("../lib/logger");

async function checkPermissions(cmd, interaction, client) {
	const isGuild = interaction.inGuild();
	const isGuildOwner =
		isGuild && interaction.user.id === interaction.guild.ownerId;

	// Walk parent chain so parent permissions apply to subcommands
	let node = cmd;
	while (node) {
		// Guild owner only
		if (node.guildOwnerOnly && !isGuildOwner) {
			if (!isGuild) {
				await interaction.reply("This command can only be used in a server.");
				return false;
			}
			await interaction.reply("Only the server owner can use this command.");
			return false;
		}

		// Bot owner only
		if (
			node.permissions?.includes("botOwner") &&
			client.owners?.length &&
			!client.owners.includes(interaction.user.id)
		) {
			await interaction.reply("This command can only be used by bot owners.");
			return false;
		}

		node = node.parentRef;
	}

	return true;
}

async function checkRestrictions(cmd, interaction) {
	if (!interaction.inGuild() || !cmd.commandId) return true;

	const isGuildOwner = interaction.user.id === interaction.guild.ownerId;
	if (isGuildOwner) return true;

	try {
		const member = interaction.member;
		const roleIds = member ? [...member.roles.cache.keys()] : [];
		const reasonLabels = {
			server: "That command is disabled in this server.",
			channel: "That command is disabled in this channel.",
			role: "That command is disabled for your role.",
			user: "That command is disabled for you.",
		};

		// Walk parent chain — check each ancestor for the source
		let restrictNode = cmd;
		let reason = null;
		while (restrictNode) {
			if (restrictNode.commandId) {
				const src = await interaction.client.db.settings.getDisableSource(
					interaction.guildId,
					interaction.channelId,
					interaction.user.id,
					roleIds,
					restrictNode.commandId,
				);
				if (src) {
					reason = src;
					break;
				}
			}
			restrictNode = restrictNode.parentRef;
		}

		if (reason) {
			let msg = reasonLabels[reason];

			// If restricted, check if the command is allowed in other channels
			try {
				const allowedChIds = await interaction.client.db.settings.getChannelAllowLocations(
					interaction.guildId,
					cmd.commandId,
				);
				if (allowedChIds.length > 0) {
					const guild = interaction.guild;
					const mentions = allowedChIds
						.map((id) => guild.channels.cache.get(id))
						.filter(Boolean)
						.map((ch) => ch.toString());
					if (mentions.length > 0) {
						msg += ` ✅ Allowed in: ${mentions.join(", ")}`;
					}
				}
			} catch { /* non-fatal */ }

			await interaction.reply(msg);
			return false;
		}
	} catch (err) {
		const log = getLogger("SlashCmd");
		log.error("Error checking restrictions:", err);
	}

	return true;
}

module.exports = {
	name: "interactionCreate",
	async execute(client, interaction) {
		if (!interaction.isChatInputCommand()) return;
		const cmd = client.slashCommands.get(interaction.commandName);
		if (!cmd) return;

		if (!(await checkPermissions(cmd, interaction, client))) return;
		if (!(await checkRestrictions(cmd, interaction))) return;

		try {
			await cmd.execute(interaction);
		} catch (e) {
			const log = getLogger("SlashCmd");
			log.error(`Error executing /${interaction.commandName}:`, e);
			interaction.reply("Error executing command.");
		}
	},
};
