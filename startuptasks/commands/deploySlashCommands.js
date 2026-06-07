const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("../../config.json");
const { getLogger } = require("../../lib/logger");
require("dotenv/config");

module.exports = {
	name: "deploySlashCommands",
	description: "Deploy slash commands on startup",
	needsReadyClient: true,
	async execute(client) {
		const log = getLogger("DeploySlash");
		const commands = [];

		const commandsPath = path.join(__dirname, "..", "..", "commands", "slash");

		const token = process.env.DISCORD_TOKEN;
		const clientId = config.clientId;
		const deployGlobal = true;

		for (const file of fs.readdirSync(commandsPath)) {
			if (!file.endsWith(".js")) continue;

			const cmd = require(path.join(commandsPath, file));
			if (!cmd?.data) continue;

			commands.push(cmd.data.toJSON());
		}

		const rest = new REST({ version: "10" }).setToken(token);

		try {
			log.info(`🚀 Deploying ${commands.length} slash commands...`);

			await rest.put(Routes.applicationCommands(clientId), {
				body: commands,
			});

			log.info("✅ Slash commands deployed!");
		} catch (err) {
			log.error("❌ Slash deploy failed:", err);
			throw err;
		}
	},
};
