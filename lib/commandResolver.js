const { getLogger } = require("./logger");
const log = getLogger("CommandResolver");

/**
 * Walk a command tree recursively, calling `visit(cmd, path)` for every node.
 */
function walkTree(client, visit) {
	for (const [name, cmd] of client.textCommands) {
		(function recurse(node, prefix) {
			visit(node, prefix);
			for (const [subName, sub] of Object.entries(
				node.subcommands || {},
			)) {
				if (sub.parentRef === node) {
					recurse(sub, `${prefix} ${subName}`);
				}
			}
		})(cmd, name);
	}
}

/**
 * Build a reverse map: commandId → canonical invocation path.
 * Handles arbitrary nesting depth.
 */
function buildIdMap(client) {
	const map = new Map();
	walkTree(client, (cmd, path) => map.set(cmd.commandId, path));
	return map;
}

/**
 * Resolve a commandId UUID to its human-readable invocation path.
 * Returns the canonical name (e.g. "manage", "tag add", "manage enable guild")
 * or null if not found.
 */
function idToName(client, commandId) {
	const map = buildIdMap(client);
	return map.get(commandId) ?? null;
}

/**
 * Build a forward map: name/alias/path → commandId.
 * Cached on the client, invalidated on command reload.
 */
function ensureNameMap(client) {
	if (client._cmdNameMap) return;

	client._cmdNameMap = new Map();

	walkTree(client, (cmd, path) => {
		// Canonical path
		client._cmdNameMap.set(path, cmd.commandId);

		// Aliases — replace last path segment with each alias
		for (const alias of cmd.aliases || []) {
			if (!cmd.parent) {
				// Top-level: alias is just the alias word
				client._cmdNameMap.set(alias, cmd.commandId);
			} else {
				// Subcommand: "tag del" from alias "del" for path "tag delete"
				const sep = path.lastIndexOf(" ");
				const prefix = sep !== -1 ? path.slice(0, sep) : "";
				client._cmdNameMap.set(`${prefix} ${alias}`, cmd.commandId);
			}
		}
	});
}

/**
 * Resolve a name/path to its commandId UUID.
 *
 * Accepts top-level names ("tag"), subcommand paths ("tag add", "manage enable guild"),
 * and top-level aliases ("tags").
 * Returns the UUID or null if not found.
 */
function nameToId(client, input) {
	ensureNameMap(client);
	return client._cmdNameMap.get(input.trim().toLowerCase()) ?? null;
}

/**
 * Resolve a name/path to the full command module object.
 * Returns { name, commandId, cmd } or null.
 */
function resolveCommand(client, input) {
	const id = nameToId(client, input);
	if (!id) return null;

	const name = idToName(client, id);
	return { name, commandId: id };
}

/**
 * Resolve a name/path to a commandId, throwing a descriptive error if not found.
 */
function resolveRequired(client, input) {
	const id = nameToId(client, input);
	if (!id) {
		throw new Error(
			`Command "${input}" not found. Use \`c.commands\` to list available commands.`,
		);
	}
	return id;
}

/**
 * Invalidate the cached name→id map (call after reloading commands).
 */
function invalidateCache(client) {
	delete client._cmdNameMap;
}

/**
 * Collect every commandId in the tree (roots + subcommands at any depth).
 */
function getAllCommandIds(client) {
	const ids = [];
	walkTree(client, (cmd) => {
		if (cmd.commandId) ids.push(cmd.commandId);
	});
	return ids;
}
function isCommandVisible(node) {
	if (!node) return false;

	// bot owner only commands
	if (node.permissions?.includes("botOwner")) {
		return false;
	}

	// guild-only restriction
	if (node.guildUse === false) {
		return false;
	}

	return true;
}

/**
 * Find the command module object by its commandId UUID.
 * Returns the node (which has .subcommands, .parentRef, .commandId) or null.
 */
function findCommandNode(client, commandId) {
	function search(node) {
		if (node.commandId === commandId) return node;
		for (const sub of Object.values(node.subcommands || {})) {
			const found = search(sub);
			if (found) return found;
		}
		return null;
	}
	for (const cmd of client.textCommands.values()) {
		const found = search(cmd);
		if (found) return found;
	}
	return null;
}

/**
 * Return all descendant subcommand IDs for a parent command.
 * Returns empty array if the commandId has no subcommands or doesn't exist.
 */
function getSubcommandIds(client, commandId) {
	const ids = [];
	const node = findCommandNode(client, commandId);
	if (!node) return ids;

	function collect(n) {
		for (const sub of Object.values(n.subcommands || {})) {
			if (sub.commandId) ids.push(sub.commandId);
			collect(sub);
		}
	}
	collect(node);
	return ids;
}

/**
 * Check if a command has any subcommands (direct children).
 */
function hasSubcommands(client, commandId) {
	const node = findCommandNode(client, commandId);
	return node ? Object.keys(node.subcommands || {}).length > 0 : false;
}

/**
 * Get the parent commandId of a command, or null if it's a top-level command.
 */
function getParentCommandId(client, commandId) {
	const node = findCommandNode(client, commandId);
	if (!node || !node.parentRef) return null;
	return node.parentRef.commandId || null;
}

module.exports = {
	idToName,
	nameToId,
	resolveCommand,
	resolveRequired,
	invalidateCache,
	getAllCommandIds,
	getSubcommandIds,
	hasSubcommands,
	getParentCommandId,
	isCommandVisible,
};
