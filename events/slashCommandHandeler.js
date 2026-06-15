const { getLogger } = require("../lib/logger");
const { buildFakeMessage, extractArgs, buildContent } = require("../lib/slashAdapter");
const { getAllCommandNames } = require("../lib/commandResolver");

// ── Reuse text command permission/location helpers ──
const {
	checkPermissions: checkTextPermissions,
	handleUseLocation: checkTextLocation,
} = require("./textCommandHandeler");

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

			if (interaction.deferred) {
				await interaction.editReply(msg);
			} else {
				await interaction.reply(msg);
			}
			return false;
		}
	} catch (err) {
		const log = getLogger("SlashCmd");
		log.error("Error checking restrictions:", err);
	}

	return true;
}

/**
 * Route a slash command to a text command via the fake message adapter.
 */
async function handleTextDerivedSlash(interaction, textCmd, client) {
	const log = getLogger("SlashAdapter");

	// Build the slash invocation path (for lookup consistency)
	const pathParts = [interaction.commandName];
	const group = interaction.options.getSubcommandGroup(false);
	const sub = interaction.options.getSubcommand(false);
	if (group) pathParts.push(group);
	if (sub) pathParts.push(sub);
	const cmdPath = pathParts.join(" ");
	const statPath = pathParts.join(".");

	// ── Defer reply first so we have a reply message to work with ──
	try {
		await interaction.deferReply();
		// buildFakeMessage will call interaction.fetchReply() to get the message
	} catch (err) {
		log.error(`Failed to defer reply for /${cmdPath}:`, err);
		return;
	}

	// ── Build fake message ──
	let fakeMessage;
	try {
		fakeMessage = await buildFakeMessage(interaction);
	} catch (err) {
		log.error(`Failed to build fake message for /${cmdPath}:`, err);
		await interaction.editReply("An error occurred setting up the command.").catch(() => {});
		return;
	}

	// ── Extract args ──
	const args = extractArgs(interaction, textCmd);

	// ── Reconstruct message content ──
	fakeMessage.content = buildContent(interaction.commandName, args, group ? [group] : []);

	// ── Run text-command permission/location checks ──
	try {
		if (!(await checkTextLocation(textCmd, client, fakeMessage))) return;
		if (!(await checkTextPermissions(textCmd, client, fakeMessage))) return;
	} catch (err) {
		log.error(`Permission check error for /${cmdPath}:`, err);
		await interaction.editReply("An error occurred checking permissions.").catch(() => {});
		return;
	}

	// ── Run text-command restriction checks ──
	try {
		if (!(await checkRestrictions(textCmd, interaction))) return;
	} catch (err) {
		log.error(`Restriction check error for /${cmdPath}:`, err);
		return;
	}

	// ── Execute the text command ──
	try {
		await textCmd.execute(fakeMessage, args);

		// ── Track stats (mirrors textCommandHandeler behavior) ──
		if (interaction.inGuild()) {
			await client.db.stats.incrementUserCommand(
				interaction.guildId,
				interaction.user.id,
				statPath,
			);
		}
		await client.db.stats.incrementUserGlobalCommand(
			interaction.user.id,
			statPath,
		);
		await client.db.stats.incrementGlobalCommand(statPath);
	} catch (err) {
		log.error(`Error executing /${cmdPath}:`, err);
		await interaction.editReply("There was an error executing that command.").catch(() => {});
	}
}

/**
 * Build the canonical slash command path from an interaction.
 * e.g. "manage disable channel"
 */
function buildCmdPath(interaction) {
	const parts = [interaction.commandName];
	const group = interaction.options.getSubcommandGroup(false);
	const sub = interaction.options.getSubcommand(false);
	if (group) parts.push(group);
	if (sub) parts.push(sub);
	return parts.join(" ");
}

// ─────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────

module.exports = {
	name: "interactionCreate",
	async execute(client, interaction) {
		// ── Autocomplete ──
		if (interaction.isAutocomplete()) {
			const log = getLogger("SlashAutocomplete");
			const cmdPath = buildCmdPath(interaction);
			const textCmd = client.slashToTextMap?.get(cmdPath);
			if (!textCmd) return interaction.respond([]).catch(() => {});

			const focused = interaction.options.getFocused(true);
			const autocompleteFn =
				textCmd.args &&
				typeof textCmd.args.getAutocompleteFn === "function" &&
				textCmd.args.getAutocompleteFn(focused.name);

			if (typeof autocompleteFn !== "function")
				return interaction.respond([]).catch(() => {});

			try {
				const choices = await autocompleteFn(focused.value, client);
				await interaction.respond(choices.slice(0, 25)).catch(() => {});
			} catch (err) {
				log.error(`Autocomplete error for /${cmdPath}:`, err);
				await interaction.respond([]).catch(() => {});
			}
			return;
		}

		if (!interaction.isChatInputCommand()) return;

		const commandName = interaction.commandName;

	// ── 1. Check manual slash commands (from commands/slash/) ──
		const manualCmd = client.slashCommands?.get(commandName);
		if (manualCmd) {
			if (!(await checkPermissions(manualCmd, interaction, client))) return;
			if (!(await checkRestrictions(manualCmd, interaction))) return;

			try {
				await manualCmd.execute(interaction);
			} catch (e) {
				const log = getLogger("SlashCmd");
				log.error(`Error executing /${commandName}:`, e);
				if (!interaction.replied && !interaction.deferred) {
					await interaction.reply("Error executing command.").catch(() => {});
				}
			}
			return;
		}

		// ── 2. Check text-command-derived slash commands ──
		if (!client.slashToTextMap) return;

		// Build the full command path for lookup
		const cmdPath = buildCmdPath(interaction);
		const textCmd = client.slashToTextMap.get(cmdPath);
		if (!textCmd) {
			// Not found in either map — silently ignore
			return;
		}

		// ── Block text-only commands (e.g. anagram which requires MessageContent) ──
		if (textCmd.slashEnabled === false) {
			await interaction.reply({
				content: "This command is text-only due to limitations.",
				ephemeral: true,
			});
			return;
		}

		await handleTextDerivedSlash(interaction, textCmd, client);
	},
};
