const fs = require('fs');
const path = require('path');

/**
 * Reload slash commands
 * @param {Client} client
 * @param {string} [name] specific command name
 */
module.exports = function reloadSlashCommands(client, name) {
	const slashPath = path.join(__dirname, '../commands/slash');

	let reloaded = 0;
	const failed = [];

	for (const file of fs.readdirSync(slashPath)) {
		if (!file.endsWith('.js')) continue;

		const filePath = path.join(slashPath, file);

		delete require.cache[require.resolve(filePath)];

		try {
			const cmd = require(filePath);
			if (!cmd?.data?.name) continue;

			if (name && cmd.data.name !== name) continue;

			client.slashCommands.set(cmd.data.name, cmd);
			reloaded++;
		} catch (err) {
			failed.push(file);
		}
	}

	return { reloaded, failed };
};
