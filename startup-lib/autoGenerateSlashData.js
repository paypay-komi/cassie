/**
 * autoGenerateSlashData — walks the loaded text command tree and generates:
 *
 * 1. SlashCommandBuilder definitions for each eligible text command
 * 2. A lookup map (slash path → text command object) for the handler
 *
 * Discord subcommand mapping:
 *   Depth 0 (top-level) → SlashCommandBuilder
 *   Depth 1             → Subcommand Group (if has children) OR Subcommand (if leaf)
 *   Depth 2             → Subcommand (always)
 *   Depth 3+            → Flattened into string options
 */

const {
	SlashCommandBuilder,
	SlashCommandSubcommandGroupBuilder,
	SlashCommandSubcommandBuilder,
	SlashCommandStringOption,
	SlashCommandIntegerOption,
	SlashCommandBooleanOption,
	SlashCommandUserOption,
	SlashCommandChannelOption,
	SlashCommandRoleOption,
	SlashCommandNumberOption,
} = require("discord.js");

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

/**
 * Truncate a string to fit within Discord's character limit for descriptions (100 chars).
 */
function truncateDescription(text, maxLen = 100) {
	if (!text || text.length <= maxLen) return text;
	return text.slice(0, maxLen - 1) + "…";
}

/**
 * Get the direct children of a command (linked via parentRef).
 */
function getDirectChildren(cmd) {
	if (!cmd.subcommands) return [];
	return Object.values(cmd.subcommands).filter(
		(sub) => sub.parentRef === cmd,
	);
}

/**
 * Check if a command should be exposed as a slash command.
 */
function isSlashEligible(cmd) {
	if (cmd.name === "help") return false; // already has its own slash handler
	if (cmd.name === "action") return false; // split into /action1–6 manually due to 25-subcommand limit
	return true;
}

// ─────────────────────────────────────────────────
// Option generation
// ─────────────────────────────────────────────────

/**
 * Map option type to the correct builder method name on the parent builder.
 */
function _getAddMethod(type) {
	const map = {
		3: "addStringOption",
		4: "addIntegerOption",
		5: "addBooleanOption",
		6: "addUserOption",
		7: "addChannelOption",
		8: "addRoleOption",
		10: "addNumberOption",
	};
	return map[type] || "addStringOption";
}

/**
 * Create the right option builder instance from a Discord option descriptor.
 */
function _makeOptionBuilder(opt) {
	let b;
	switch (opt.type) {
		case 3: b = new SlashCommandStringOption(); break;
		case 4: b = new SlashCommandIntegerOption(); break;
		case 5: b = new SlashCommandBooleanOption(); break;
		case 6: b = new SlashCommandUserOption(); break;
		case 7: b = new SlashCommandChannelOption(); break;
		case 8: b = new SlashCommandRoleOption(); break;
		case 10: b = new SlashCommandNumberOption(); break;
		default: b = new SlashCommandStringOption(); break;
	}

	b.setName(opt.name);
	b.setDescription(truncateDescription(opt.description) || opt.name);
	if (opt.required) b.setRequired(true);
	if (opt.autocomplete && typeof b.setAutocomplete === "function") {
		b.setAutocomplete(true);
	}

	return { builder: b, addMethod: _getAddMethod(opt.type) };
}

/**
 * Add Discord options to a subcommand/builder from a command's args metadata.
 */
function addCommandOptions(builder, cmd) {
	if (cmd.args && typeof cmd.args.toSlashOptions === "function") {
		// Use ArgsBuilder's typed definitions
		for (const opt of cmd.args.toSlashOptions()) {
			const { builder: optBuilder, addMethod } = _makeOptionBuilder(opt);
			if (typeof builder[addMethod] === "function") {
				builder[addMethod](optBuilder);
			}
		}
		return;
	}

	// No args builder — add generic string "input" option for leaf commands
	if (typeof cmd.execute === "function") {
		const children = getDirectChildren(cmd);
		if (children.length === 0) {
			try {
				const opt = new SlashCommandStringOption()
					.setName("input")
					.setDescription("Command input")
					.setRequired(false);
				builder.addStringOption(opt);
			} catch {
				// Builder may not support options — silently skip
			}
		}
	}
}

// ─────────────────────────────────────────────────
// Recursive tree builder
// ─────────────────────────────────────────────────

/**
 * Recursively build a SlashCommandBuilder from a top-level text command.
 */
function buildTopLevelCommand(cmd) {
	const builder = new SlashCommandBuilder()
		.setName(cmd.name)
		.setDescription(truncateDescription(cmd.description) || "No description");

	const children = getDirectChildren(cmd);

	if (children.length > 0) {
		// Has subcommands — add them as subcommand groups or raw subcommands
		for (const child of children) {
			addSubOrGroup(builder, child, 1);
		}
	} else {
		// Leaf node — add options directly
		addCommandOptions(builder, cmd);
	}

	return builder;
}

/**
 * Add a subcommand or subcommand group to a builder.
 *
 * @param {SlashCommandBuilder|SlashCommandSubcommandGroupBuilder} parent
 * @param {object} cmd
 * @param {number} depth — 1 = direct child of top-level, 2 = grandchild, etc.
 */
function addSubOrGroup(parent, cmd, depth) {
	const children = getDirectChildren(cmd);

	if (depth === 1 && children.length > 0) {
		// ── Subcommand Group (depth 1, has children) ──
		const group = new SlashCommandSubcommandGroupBuilder()
			.setName(cmd.name)
			.setDescription(truncateDescription(cmd.description) || "No description");

		for (const child of children) {
			addSubOrGroup(group, child, 2);
		}

		try {
			parent.addSubcommandGroup(group);
		} catch {
			// Parent may not support subcommand groups — fallback
		}
	} else {
		// ── Subcommand (depth 1 leaf, depth 2+, or any leaf) ──
		const sub = new SlashCommandSubcommandBuilder()
			.setName(cmd.name)
			.setDescription(truncateDescription(cmd.description) || "No description");

		// If there are deeper children beyond Discord's 2-level support,
		// flatten remaining nesting as string options
		if (children.length > 0 && depth >= 2) {
			try {
				sub.addStringOption(
					new SlashCommandStringOption()
						.setName("subcommand")
						.setDescription("Subcommand path")
						.setRequired(false),
				);
			} catch {
				// Ignore if options already exist
			}
		}

		// Add command-specific options
		addCommandOptions(sub, cmd);

		try {
			parent.addSubcommand(sub);
		} catch {
			// May already have subcommands — skip if so
		}
	}
}

// ─────────────────────────────────────────────────
// Lookup map builder
// ─────────────────────────────────────────────────

/**
 * Build the slash-path → text-command lookup map.
 * Key example: "tag add", "manage disable channel", "ping"
 */
function buildLookupMap(client) {
	const map = new Map();

	function walk(cmd, path = []) {
		const currentPath = [...path, cmd.name];
		const children = getDirectChildren(cmd);

		// Only map commands that have an execute function
		if (typeof cmd.execute === "function") {
			map.set(currentPath.join(" "), cmd);
		}

		// Recurse into children
		for (const child of children) {
			walk(child, currentPath);
		}
	}

	for (const cmd of client.textCommands.values()) {
		walk(cmd, []);
	}

	return map;
}

// ─────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────

/**
 * Generate slash command data from loaded text commands.
 *
 * Sets on the client:
 *   client._generatedSlashData  — Array of JSON command definitions for deployment
 *   client.slashToTextMap       — Map<string, object> for routing
 *
 * @param {import("discord.js").Client} client
 * @returns {{ count: number, names: string[] }}
 */
function autoGenerateSlashData(client) {
	if (!client.textCommands || client.textCommands.size === 0) {
		const { getLogger } = require("../lib/logger");
		const log = getLogger("AutoSlash");
		log.warn("No text commands loaded — skipping slash auto-generation.");
		return { count: 0, names: [] };
	}

	const { getLogger } = require("../lib/logger");
	const log = getLogger("AutoSlash");

	const definitions = [];
	const names = [];
	let skipped = 0;

	for (const cmd of client.textCommands.values()) {
		if (!isSlashEligible(cmd)) {
			skipped++;
			continue;
		}

		try {
			const builder = buildTopLevelCommand(cmd);
			definitions.push(builder.toJSON());
			names.push(cmd.name);
		} catch (err) {
			log.error(`Failed to generate slash data for "${cmd.name}":`, err);
			skipped++;
		}
	}

	// Store on client for deploy and routing
	client._generatedSlashData = definitions;
	client.slashToTextMap = buildLookupMap(client);

	log.info(
		`✅ Generated slash definitions for ${definitions.length} commands (${skipped} skipped)`,
	);
	log.info(`   Commands: ${names.join(", ")}`);

	// Debug: log all mapped paths
	if (client.slashToTextMap.size > 0) {
		log.debug(`   Lookup paths: ${[...client.slashToTextMap.keys()].join(", ")}`);
	}

	return { count: definitions.length, names };
}

module.exports = autoGenerateSlashData;
