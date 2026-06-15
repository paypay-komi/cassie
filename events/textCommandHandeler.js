const { Events, PermissionsBitField, Message, Client } = require("discord.js");
const { getLogger } = require("../lib/logger");
const didYouMean = require("../utils/didyoumean.js");
/**
 * Show available subcommands when parent is called
 */
function showSubcommandHelp(command, message) {
	const subs = command.subcommands ?? {};

	// Only list direct subcommands of this command
	const names = [
		...new Set(
			Object.values(subs)
				.filter((cmd) => cmd.parentRef === command)
				.map((cmd) => cmd.name),
		),
	];

	if (!names.length) {
		return message.reply("This command has no subcommands.");
	}

	return message.reply(
		`Please specify a subcommand. Available subcommands: ${names.join(", ")}`,
	);
}

/**
 * Resolve nested subcommands (supports aliases).
 * Stops at the first arg that doesn't match a subcommand name.
 *
 * The resolved command's `execute` receives the remaining args and a `next()`
 * callback. If the command wants to continue subcommand resolution after
 * consuming some args, it can call `next(remainingArgs)`.
 */
function resolveNested(command, args) {
	let current = command;
	const path = [current.name];

	while (args.length && current.subcommands) {
		const input = args[0].toLowerCase();

		const next =
			current.subcommands[input] ||
			Object.values(current.subcommands).find((sc) =>
				sc.aliases?.includes(input),
			);

		if (!next) break;

		args.shift();
		current = next;
		path.push(current.name);
	}

	return { command: current, path };
}

/**
 * @param {Client} client
 * @param {import("discord.js").Message} message
 */
async function checkPermissions(command, client, message) {
	let node = command;

	const isGuild = message.inGuild();
	const isGuildOwner =
		isGuild && message.author.id === message.guild.ownerId;

	// SAFE: only fetch member in guilds
	const clientMember = isGuild ? await message.guild.members.fetchMe() : null;

	while (node) {
		// Guild owner only (unless overrides grant access later)
		if (node.guildOwnerOnly && !isGuildOwner) {
			if (!isGuild) {
				message.reply("This command can only be used in a server.");
				return false;
			}
			message.reply("Only the server owner can use this command.");
			return false;
		}

		// Bot owner only
		if (
			node.permissions?.includes("botOwner") &&
			client.owners?.length &&
			!client.owners.includes(message.author.id)
		) {
			message.reply("This command can only be used by bot owners.");
			return false;
		}

		// Required bot permissions
		if (node.requiredBotPermissions?.length) {
			if (!isGuild) return true; // DMs bypass permissions safely

			const missing = [];

			for (const perm of node.requiredBotPermissions) {
				if (!message.channel.permissionsFor(clientMember).has(perm)) {
					const name =
						new PermissionsBitField(perm)
							.toArray()[0]
							?.replace(/([a-z])([A-Z])/g, "$1 $2") ?? perm;

					missing.push(name);
				}
			}

			if (missing.length) {
				message.reply(
					`I need the ${missing.join(", ")} permission(s) to run this command.`,
				);
				return false;
			}
		}

		// Required user permissions
		if (node.requiredUserPermissions?.length) {
			if (!isGuild) return true; // DMs bypass permissions safely

			const missing = [];

			for (const perm of node.requiredUserPermissions) {
				if (!message.member.permissionsIn(message.channel).has(perm)) {
					const name =
						new PermissionsBitField(perm)
							.toArray()[0]
							?.replace(/([a-z])([A-Z])/g, "$1 $2") ?? perm;

					missing.push(name);
				}
			}

			if (missing.length) {
				message.reply(
					`You need the ${missing.join(", ")} permission(s) to use this command.`,
				);
				return false;
			}
		}

		node = node.parentRef;
	}

	return true;
}
/**
 *
 * @param {any} command
 * @param {*} client
 * @param {Message} message
 * @returns
 */
async function handleUseLocation(command, client, message) {
	let node = command;

	while (node) {
		if (Object.hasOwn(node, "dmUse") && !node.dmUse && !message.inGuild()) {
			message.reply("this command must be used in a server");
			return false;
		}
		if (
			Object.hasOwn(node, "guildUse") &&
			!node.guildUse &&
			message.inGuild()
		) {
			try {
				await message.author.send(
					`This command (\`${command.name}\`) only works in DMs. Use it here instead!`,
				);
				message.reply("Sent you a DM!");
			} catch {
				message.reply(
					"This command only works in DMs. I couldn't DM you — check your privacy settings so server members can DM you.",
				);
			}
			return false;
		}
		node = node.parentRef;
	}

	return true;
}

module.exports = {
	checkPermissions,
	handleUseLocation,
	showSubcommandHelp,
	name: Events.MessageCreate,
	async execute(client, message) {
		if (message.author.bot) return;

		const content = message.content;
		const lowerContent = content.toLowerCase();

		// ── Determine prefix priority: custom user > guild > default "c." ──
		let matchedPrefix = null;

		// 1. Check default "c."
		if (lowerContent.startsWith("c.")) matchedPrefix = "c.";

		// 2. Check guild prefix (for guild messages)
		if (message.inGuild()) {
			try {
				const guildSettings = await client.db.guild.get(message.guildId);
				const guildPrefix = guildSettings?.prefix;
				if (guildPrefix && content.startsWith(guildPrefix)) {
					matchedPrefix = guildPrefix;
				}
			} catch { /* DB error, ignore */ }
		}

		// 3. Check user custom prefix (highest priority)
		let customPrefix = null;
		try {
			const data = await client.db.userPrefix.get(message.author.id);
			if (data?.prefix) customPrefix = data.prefix;
		} catch { /* DB error, ignore */ }
		if (customPrefix && content.startsWith(customPrefix)) {
			matchedPrefix = customPrefix;
		}

		if (!matchedPrefix) return;

		const args = content.slice(matchedPrefix.length).trim().split(/ +/);
		const input = args.shift().toLowerCase();

		const { textCommands, textAliases } = client;

		// ---------------------------
		// Resolve top-level command
		// ---------------------------
		const commandName = textCommands.has(input)
			? input
			: textAliases.get(input);

		if (!commandName) {
			const suggestion = didYouMean(
				input + " " + args.join(" "),
				message.client.textCommands,
			);
			return message.reply(
				`That's not a valid command! Did you mean: ${suggestion}?`,
			);
		}

		const command = textCommands.get(commandName);

		// ---------------------------
		// Resolve nested subcommands
		// ---------------------------
		const { command: finalCommand, path } = resolveNested(command, args);

	// ---------------------------
	// Use location (dm vs guild) — cheapest check first
	// ---------------------------
	if (!(await handleUseLocation(finalCommand, client, message))) return;

	// ---------------------------
	// Permissions
	// ---------------------------
			if (!(await checkPermissions(finalCommand, client, message))) return;

	// ---------------------------
	// Restrictions (disabled/deny overrides)
	// ---------------------------
	const cmdIdForLog = finalCommand.commandId;
	if (message.inGuild() && cmdIdForLog) {
		const isGuildOwner = message.author.id === message.guild.ownerId;

		if (isGuildOwner) {
			const log = getLogger("TextCmd");
			log.debug(`Skipping restrictions for guild owner ${message.author.id}`);
		}

		if (!isGuildOwner) {
			try {
				const roleIds = [...message.member.roles.cache.keys()];
				const reasonLabels = {
					server: "That command is disabled in this server.",
					channel: "That command is disabled in this channel.",
					role: "That command is disabled for your role.",
					user: "That command is disabled for you.",
				};

				// Walk parent chain — check each ancestor for the source
				let restrictNode = finalCommand;
				let reason = null;
				while (restrictNode) {
					if (restrictNode.commandId) {
						const src = await client.db.settings.getDisableSource(
							message.guildId,
							message.channelId,
							message.author.id,
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
						const allowedChIds = await client.db.settings.getChannelAllowLocations(
							message.guildId,
							finalCommand.commandId,
						);
						if (allowedChIds.length > 0) {
							const mentions = allowedChIds
								.map((id) => message.guild.channels.cache.get(id))
								.filter(Boolean)
								.map((ch) => ch.toString());
							if (mentions.length > 0) {
								msg += ` ✅ Allowed in: ${mentions.join(", ")}`;
							}
						}
					} catch { /* non-fatal */ }

					return message.reply(msg);
				}
			} catch (err) {
				const log = getLogger("TextCmd");
				log.error("Error checking restrictions:", err);
			}
		}

		if (cmdIdForLog) {
			console.log(
				"[RESTRICT_EXIT] commandId=%s guildId=%s authorId=%s ownerId=%s allowed=true",
				cmdIdForLog,
				message.guildId,
				message.author.id,
				message.guild?.ownerId,
			);
		}
	}

	// ---------------------------
	// Execute — with next() for intermediate commands
	// ---------------------------
	async function runCommandChain(cmd, remArgs, pathSoFar) {
		if (typeof cmd.execute !== "function") {
			return showSubcommandHelp(cmd, message);
		}

		// next() lets intermediate commands continue subcommand resolution
		// after consuming target args
		const next = async (remainingArgs) => {
			const { command: sub, path: subPath } = resolveNested(
				cmd,
				remainingArgs,
			);

			if (sub === cmd || typeof sub.execute !== "function") {
				return showSubcommandHelp(sub, message);
			}

			// Append new segments to the existing path
			const fullPath = [...pathSoFar, ...subPath.slice(1)];
			return runCommandChain(sub, remainingArgs, fullPath);
		};

		try {
			await cmd.execute(message, remArgs, next);

			// Stats
			const statName = pathSoFar.join(".");
			if (message.inGuild()) {
				await client.db.stats.incrementUserCommand(
					message.guildId,
					message.author.id,
					statName,
				);
			}
			await client.db.stats.incrementUserGlobalCommand(
				message.author.id,
				statName,
			);
			await client.db.stats.incrementGlobalCommand(statName);
		} catch (err) {
			const log = getLogger("TextCmd");
			log.error(`Error executing ${pathSoFar.join(".")}:`, err);
			try {
				await message.reply("There was an error executing that command.");
			} catch {
				log.warn(
					`Failed to reply error message — original message was probably deleted`,
				);
			}
		}
	}

	await runCommandChain(finalCommand, args, path);
	},
};
