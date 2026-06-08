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
 * Resolve nested subcommands (supports aliases and middle args).
 *
 * Middle args are args that don't match any subcommand at a given level.
 * They are collected and stored on the final leaf command as `_middleArgs[]`.
 *
 * Example: `c.manage channel #general disable tag`
 *   manage → channel (next) → #general (middle) → disable (next) → tag (none)
 *   Result: command=disable, args=["tag"], disable._middleArgs=["#general"]
 */
function resolveNested(command, args) {
	let current = command;
	const path = [current.name];
	const middleArgs = [];

	while (
		args.length &&
		current.subcommands &&
		Object.keys(current.subcommands).length > 0
	) {
		const input = args[0].toLowerCase();

		// Check name first, then aliases
		const next =
			current.subcommands[input] ||
			Object.values(current.subcommands).find((sc) =>
				sc.aliases?.includes(input),
			);

		if (!next) {
			// Not a subcommand — stash as a middle arg for the leaf
			middleArgs.push(args.shift());
			continue;
		}

		args.shift();
		current = next;
		path.push(current.name);
	}

	// Attach middle args so leaf commands can get their target
	current._middleArgs = middleArgs;

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

		// Discord permissions
		if (node.requiredDiscordPermissions?.length) {
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
					`I lack the required permissions: ${missing.join(", ")} to run this command`,
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
function handleUseLocation(command, client, message) {
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
			message.reply("this command must be used in dms");
			return false;
		}
		node = node.parentRef;
	}

	return true;
}

module.exports = {
	name: Events.MessageCreate,
	async execute(client, message) {
		if (message.author.bot) return;

		const content = message.content;
		const startsWithC = content.toLowerCase().startsWith("c.");

		// Look up user's custom prefix from DB
		let customPrefix = null;
		try {
			const data = await client.db.userPrefix.get(message.author.id);
			if (data?.prefix) customPrefix = data.prefix;
		} catch { /* DB error, stick with c. */ }

		const matchesCustom = customPrefix && content.startsWith(customPrefix);

		if (!startsWithC && !matchesCustom) return;

		const matchedPrefix = matchesCustom ? customPrefix : "c.";
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
		// Auto parent help if no execute()
		// ---------------------------
		if (typeof finalCommand.execute !== "function") {
			return showSubcommandHelp(finalCommand, message);
		}

	// ---------------------------
	// Use location (dm vs guild) — cheapest check first
	// ---------------------------
	if (!handleUseLocation(finalCommand, client, message)) return;

	// ---------------------------
	// Permissions
	// ---------------------------
	if (!(await checkPermissions(finalCommand, client, message))) return;

	// ---------------------------
	// Restrictions (disabled/deny overrides)
	// ---------------------------
	if (message.inGuild() && finalCommand.commandId) {
		const isGuildOwner = message.author.id === message.guild.ownerId;

		if (!isGuildOwner) {
			try {
				const roleIds = [...message.member.roles.cache.keys()];
				const effective = await client.db.settings.getEffective(
					message.guildId,
					message.channelId,
					message.author.id,
					roleIds,
				);

				if (effective.disabledCommands.includes(finalCommand.commandId)) {
					return message.reply("That command is disabled in this server.");
				}
			} catch (err) {
				const log = getLogger("TextCmd");
				log.error("Error checking restrictions:", err);
			}
		}
	}

	// ---------------------------
	// Execute
	// ---------------------------
		try {
			await finalCommand.execute(message, args);

			// ---------------------------
			// Stats
			// ---------------------------
			const statName = path.join(".");

			if (message.inGuild()) {
				const gid = message.guild.id;
				await client.db.stats.incrementUserCommand(
					gid,
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
			log.error(`Error executing ${path.join(".")}:`, err);
			message.reply("There was an error executing that command.");
		}
	},
};
