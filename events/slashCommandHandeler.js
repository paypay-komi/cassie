const { getLogger } = require("../lib/logger");

async function checkPermissions(cmd, interaction, client) {
	const isGuild = interaction.inGuild();
	const isGuildOwner =
		isGuild && interaction.user.id === interaction.guild.ownerId;

	// Guild owner only (unless overrides grant access later)
	if (cmd.guildOwnerOnly && !isGuildOwner) {
		if (!isGuild) {
			await interaction.reply("This command can only be used in a server.");
			return false;
		}
		await interaction.reply("Only the server owner can use this command.");
		return false;
	}

	// Bot owner only
	if (
		cmd.permissions?.includes("botOwner") &&
		client.owners?.length &&
		!client.owners.includes(interaction.user.id)
	) {
		await interaction.reply("This command can only be used by bot owners.");
		return false;
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
		const effective = await interaction.client.db.settings.getEffective(
			interaction.guildId,
			interaction.channelId,
			interaction.user.id,
			roleIds,
		);

		if (effective.disabledCommands.includes(cmd.commandId)) {
			await interaction.reply("That command is disabled in this server.");
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
