const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');
module.exports = async function deploySlashCommands(client, options = {}) {
	const commands = [];

	const commandsPath =
		options.commandsPath || path.join(__dirname, '..', 'commands', 'slash');

	const token = config.token;
	const clientId = config.clientId;
	const guildId = options.guildId;
	const deployGlobal = options.global || false;

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
			deployGlobal
				? Routes.applicationCommands(clientId)
				: Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log('✅ Slash commands deployed!');
	} catch (err) {
		console.error('❌ Slash deploy failed:', err);
		throw err;
	}
};
