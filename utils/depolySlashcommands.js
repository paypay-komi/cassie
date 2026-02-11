const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * Deploy slash commands
 * @param {Object} options
 * @param {string} options.token Discord bot token
 * @param {string} options.clientId Application ID
 * @param {string} options.guildId Guild ID (omit for global)
 * @param {string} [options.commandsPath] Path to slash commands folder
 * @param {boolean} [options.global=false] Deploy globally
 */
module.exports = async function deploySlashCommands({
	token,
	clientId,
	guildId,
	commandsPath = path.join(__dirname, '../commands/slash'),
	global = true
}) {
	const commands = [];

	for (const file of fs.readdirSync(commandsPath)) {
		if (!file.endsWith('.js')) continue;

		const cmd = require(path.join(commandsPath, file));
		if (!cmd?.data) continue;

		commands.push(cmd.data.toJSON());
	}

	const rest = new REST({ version: '10' }).setToken(token);

	try {
		console.log(`🚀 Deploying ${commands.length} slash commands...`);

		await rest.put(
			global
				? Routes.applicationCommands(clientId)
				: Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands }
		);

		console.log('✅ Slash commands deployed!');
	} catch (err) {
		console.error('❌ Slash deploy failed:', err);
		throw err;
	}
};
