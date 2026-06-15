const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getLogger } = require("../lib/logger");

const log = getLogger("ReloadTextCmds");

/**
 * Recursively walk directories to collect .js files
 */
function walk(dir, files = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			walk(fullPath, files);
		} else if (entry.isFile() && entry.name.endsWith(".js")) {
			files.push(fullPath);
		}
	}
	return files;
}

/**
 * Inject a commandId into a command JS file if it doesn't already have one.
 * Inserts `commandId: "<uuid>",` right after `module.exports = {`.
 */
function injectCommandId(filePath) {
	const raw = fs.readFileSync(filePath, "utf-8");
	const uuid = crypto.randomUUID();

	// Detect indentation style from the file (tabs or spaces)
	const indentMatch = raw.match(/\n(\s+)/);
	const indent = indentMatch ? indentMatch[1] : "\t";

	// Insert commandId after `module.exports = {`
	const replaced = raw.replace(
		/(module\.exports\s*=\s*\{)/,
		`$1\n${indent}commandId: "${uuid}",`,
	);

	if (replaced === raw) {
		log.warn(`⚠️ Could not inject commandId into ${filePath}`);
		return null;
	}

	fs.writeFileSync(filePath, replaced, "utf-8");
	log.info(`🔖 Injected commandId ${uuid} into ${filePath}`);
	return uuid;
}

/**
 * Recursively collect all possible invocation paths including aliases
 */
function collectAllPaths(cmd, parents = []) {
	const paths = [];
	const currentNames = [cmd.name, ...(cmd.aliases || [])]; // canonical + aliases

	for (const name of currentNames) {
		const newParents = [...parents, name];

		if (!cmd.subcommands || Object.keys(cmd.subcommands).length === 0) {
			// no more subcommands, push current path
			paths.push(newParents.join(" "));
			continue;
		}

		// iterate over direct subcommands (canonical names only)
		for (const sub of Object.values(cmd.subcommands)) {
			if (sub.parentRef === cmd) {
				paths.push(...collectAllPaths(sub, newParents));
			}
		}
	}

	return paths;
}

/**
 * Reload text commands and build nested subcommands
 */
module.exports = function reloadTextCommands(client, targetName) {
	const textPath = path.join(__dirname, "..", "commands", "text");

	client.textCommands ??= new Map();
	client.textAliases ??= new Map();

	let reloaded = 0;
	let subcommands = 0;
	const failed = [];

	const files = walk(textPath);
	log.debug("🔹 Files found for loading:", files);

	// clear all project modules from cache so any changed files get picked up
	const root = path.resolve(__dirname, "..");
	for (const id of Object.keys(require.cache)) {
		if (id.startsWith(root) && !id.includes("node_modules"))
			delete require.cache[id];
	}

	const allCommands = new Map();

	// --------------------------------------------------
	// Load all command modules
	// --------------------------------------------------
	for (const filePath of files) {
		delete require.cache[require.resolve(filePath)];

		try {
			const cmd = require(filePath);

			if (!cmd?.name) {
				log.warn(`⚠️ Skipping ${filePath}: no name found`);
				continue;
			}

			cmd.name = cmd.name.toLowerCase();
			cmd.parent = cmd.parent?.toLowerCase() ?? null;
			cmd.aliases = (cmd.aliases || []).map((a) => a.toLowerCase());

			// Generate + persist commandId if not already set on the module
			if (!cmd.commandId) {
				const uuid = injectCommandId(filePath);
				if (!uuid) continue; // injection failed
				cmd.commandId = uuid;
			}

			// ONLY canonical subcommands
			cmd.subcommands ??= {};
			cmd.parentRef = null;

			if (
				targetName &&
				cmd.name !== targetName &&
				cmd.parent !== targetName
			) {
				continue;
			}

			const key = `${cmd.parent ?? "root"}:${cmd.name}`;

			if (allCommands.has(key)) {
				log.warn(
					`⚠️ Duplicate command "${cmd.name}" under parent "${cmd.parent ?? "root"}"`,
				);
				continue;
			}

			allCommands.set(key, cmd);
			log.info(`✅ Loaded command: ${key} from ${filePath}`);
		} catch (err) {
			log.error(`❌ Failed loading ${filePath}`);
			log.error(err);
			failed.push(path.basename(filePath));
		}
	}

	log.debug("🔹 All commands after first pass:", [...allCommands.keys()]);

	if (!targetName) {
		client.textCommands.clear();
		client.textAliases.clear();
	}

	// --------------------------------------------------
	// Link parents and register top-level commands
	// --------------------------------------------------
	for (const cmd of allCommands.values()) {
		// -------------------------
		// Subcommand
		// -------------------------
		if (cmd.parent) {
			const parent = [...allCommands.values()].find(
				(c) => c.name === cmd.parent,
			);

			if (!parent) {
				log.warn(
					`⚠️ Parent "${cmd.parent}" not found for "${cmd.name}"`,
				);
				continue;
			}

			// ONLY store canonical name
			parent.subcommands[cmd.name] = cmd;
			cmd.parentRef = parent;

			subcommands++;
			log.info(
				`🔹 Linked ${cmd.name} as subcommand of ${parent.name}`,
			);
			continue;
		}

		// -------------------------
		// Top-level command
		// -------------------------
		client.textCommands.set(cmd.name, cmd);

		for (const alias of cmd.aliases) {
			client.textAliases.set(alias, cmd.name);
		}

		reloaded++;
		log.info(`🔹 Registered top-level command: ${cmd.name}`);
	}

	log.debug("🔹 Final client.textCommands:", [
		...client.textCommands.keys(),
	]);
	log.debug("🔹 Final client.textAliases:", [...client.textAliases.keys()]);

	// --------------------------------------------------
	// 🔹 Print all valid invocation paths (including aliases)
	// --------------------------------------------------
	log.info("\n📋 All valid command invocations:");
	for (const rootCmd of client.textCommands.values()) {
		const paths = collectAllPaths(rootCmd);
		paths.forEach((p) => log.info(`!${p}`));
	}

	// --------------------------------------------------
	// 🔹 Regenerate slash command definitions from text commands
	// --------------------------------------------------
	try {
		const autoGenerateSlashData = require("./autoGenerateSlashData");
		autoGenerateSlashData(client);
		log.info("✅ Slash definitions regenerated from text commands");
	} catch (err) {
		log.warn("⚠️ Could not regenerate slash definitions:", err.message);
	}

	return { reloaded, subcommands, failed };
};
