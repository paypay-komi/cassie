const { getLogger } = require("./logger");
const log = getLogger("CommandResolver");

/**
 * Build a reverse map: commandId → canonical invocation path(s).
 */
function buildIdMap(client) {
	const map = new Map();

	for (const [name, cmd] of client.textCommands) {
		map.set(cmd.commandId, name);
		for (const [subName, sub] of Object.entries(cmd.subcommands)) {
			map.set(sub.commandId, `${name} ${subName}`);
		}
	}

	return map;
}

/**
 * Resolve a commandId UUID to its human-readable invocation path.
 * Returns the canonical name (e.g. "tag" or "tag add") or null if not found.
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

	// Top-level names + aliases
	for (const [name, cmd] of client.textCommands) {
		client._cmdNameMap.set(name, cmd.commandId);
	}
	for (const [alias, canonical] of client.textAliases) {
		const cmd = client.textCommands.get(canonical);
		if (cmd) client._cmdNameMap.set(alias, cmd.commandId);
	}

	// Subcommand paths ("tag add", "tag delete", etc.)
	for (const [, cmd] of client.textCommands) {
		for (const [subName, sub] of Object.entries(cmd.subcommands)) {
			client._cmdNameMap.set(`${cmd.name} ${subName}`, sub.commandId);
		}
	}
}

/**
 * Resolve a name/path to its commandId UUID.
 *
 * Accepts top-level names ("tag"), subcommand paths ("tag add"), and aliases ("tags").
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

module.exports = { idToName, nameToId, resolveCommand, resolveRequired, invalidateCache };
