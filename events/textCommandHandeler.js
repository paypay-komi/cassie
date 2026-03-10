const { Events, PermissionsBitField } = require("discord.js");
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
 * Resolve nested subcommands (supports aliases)
 */
function resolveNested(command, args) {
	let current = command;
	const path = [current.name];

	while (args.length && current.subcommands) {
		const input = args[0].toLowerCase();

		// Check name first, then aliases
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
 * Walk parent chain to check permissions
 */
function checkPermissions(command, client, message) {
	let node = command;

	while (node) {
		// Discord permissions
		if (node.requiredDiscordPermissions?.length) {
			const missing = node.requiredDiscordPermissions.filter((perm) => {
				const flag = PermissionsBitField.Flags[perm] ?? perm;
				return !message.member.permissions.has(flag);
			});

			if (missing.length) {
				message.reply(
					`You lack the required permissions: ${missing.join(", ")}`,
				);
				return false;
			}
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

		node = node.parentRef;
	}

	return true;
}

module.exports = {
	name: Events.MessageCreate,
	async execute(client, message) {
		const prefix = client.prefix;

		if (!message.guild) return;
		if (message.author.bot) return;
		if (!message.content.toLowerCase().startsWith(prefix)) return;

		const args = message.content.slice(prefix.length).trim().split(/ +/);

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
		// Permissions
		// ---------------------------
		if (!checkPermissions(finalCommand, client, message)) return;

		// ---------------------------
		// Execute
		// ---------------------------
		try {
			await finalCommand.execute(message, args);

			// ---------------------------
			// Stats
			// ---------------------------
			const statName = path.join(".");
			const gid = message.guild.id;

			await client.db.stats.incrementUserCommand(
				gid,
				message.author.id,
				statName,
			);
			await client.db.stats.incrementUserGlobalCommand(
				message.author.id,
				statName,
			);
			await client.db.stats.incrementGlobalCommand(statName);
		} catch (err) {
			console.error(err);
			message.reply("There was an error executing that command.");
		}
	},
};
