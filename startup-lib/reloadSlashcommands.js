const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Inject a commandId into a slash command JS file if it doesn't already have one.
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
		return null;
	}

	fs.writeFileSync(filePath, replaced, "utf-8");
	return uuid;
}

/**
 * Reload slash commands
 * @param {Client} client
 * @param {string} [name] specific command name
 */
module.exports = function reloadSlashCommands(client, name) {
	const slashPath = path.join(__dirname, "..", "commands", "slash");

	let reloaded = 0;
	const failed = [];

	for (const file of fs.readdirSync(slashPath)) {
		if (!file.endsWith(".js")) continue;

		const filePath = path.join(slashPath, file);

		delete require.cache[require.resolve(filePath)];

		try {
			const cmd = require(filePath);
			if (!cmd?.data?.name) continue;

			if (name && cmd.data.name !== name) continue;

			// Generate + persist commandId if not already set
			if (!cmd.commandId) {
				const uuid = injectCommandId(filePath);
				if (!uuid) {
					failed.push(file);
					continue;
				}
				cmd.commandId = uuid;
			}

			client.slashCommands.set(cmd.data.name, cmd);
			reloaded++;
		} catch (err) {
			failed.push(file);
		}
	}

	return { reloaded, failed };
};
