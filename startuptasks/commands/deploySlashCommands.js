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
	prerequisites: ["loadSlashCommands", "generateSlashFromText"],
	async execute(client) {
		const log = getLogger("DeploySlash");
		const commands = [];

		// ── 1. Manual slash commands (from commands/slash/) ──
		const commandsPath = path.join(__dirname, "..", "..", "commands", "slash");

		for (const file of fs.readdirSync(commandsPath)) {
			if (!file.endsWith(".js")) continue;

			const cmd = require(path.join(commandsPath, file));
			if (!cmd?.data) continue;

			commands.push(cmd.data.toJSON());
		}

		log.info(`📋 Manual slash commands: ${commands.length}`);

		// ── 2. Auto-generated slash commands from text commands ──
		const generated = client._generatedSlashData;
		if (generated && generated.length > 0) {
			log.info(`📋 Auto-generated slash commands: ${generated.length}`);
			commands.push(...generated);
		} else {
			log.info("📋 No auto-generated slash commands to deploy.");
		}

		// ── 3. Deploy all commands to Discord ──
		const token = process.env.DISCORD_TOKEN;
		const clientId = config.clientId;

		const rest = new REST({ version: "10" }).setToken(token);

		try {
			log.info(`🚀 Deploying ${commands.length} slash commands total...`);

			await rest.put(Routes.applicationCommands(clientId), {
				body: commands,
			});

			log.info("✅ Slash commands deployed successfully!");

			// Log all deployed command names
			const names = commands.map((c) => c.name);
			log.info(`   Commands: ${names.join(", ")}`);
		} catch (err) {
			log.error("❌ Slash deploy failed:", err);
			throw err;
		}
	},
};
