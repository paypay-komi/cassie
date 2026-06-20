const { REST, Routes, SlashCommandBuilder, SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("../../config.json");
const { getLogger } = require("../../lib/logger");
const { GROUPS } = require("../../utils/actionGroups");
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
		//    Filter OUT the auto-generated /action (112 subcommands — too many)
		//    so we can replace it with /action1-5 below.
		const generated = (client._generatedSlashData || []).filter(
			(c) => c.name !== "action",
		);
		if (generated.length > 0) {
			log.info(`📋 Auto-generated slash commands (excluding /action): ${generated.length}`);
			commands.push(...generated);
		} else {
			log.info("📋 No auto-generated slash commands to deploy.");
		}

		// ── 3. Build /action with 6 subcommand groups ──
		const actionCmd = new SlashCommandBuilder()
			.setName("action")
			.setDescription("Perform a reaction GIF action");

		for (const group of GROUPS) {
			const grp = new SlashCommandSubcommandGroupBuilder()
				.setName(group.name)
				.setDescription(`${group.actions.length} actions`);

			for (const action of group.actions) {
				const sub = new SlashCommandSubcommandBuilder()
					.setName(action)
					.setDescription(`Perform ${action} on someone`);
				grp.addSubcommand(sub);
			}

			actionCmd.addSubcommandGroup(grp);
		}

		commands.push(actionCmd.toJSON());

		// ── Add routing map entries so the slash handler can find the text command ──
		// e.g. "action aggressive hug" → action's hug subcommand
		if (client.slashToTextMap) {
			const actionTextCmd = client.textCommands?.get("action");
			if (actionTextCmd?.subcommands) {
				for (const group of GROUPS) {
					for (const action of group.actions) {
						const subCmd = actionTextCmd.subcommands[action];
						if (subCmd) {
							client.slashToTextMap.set(`action ${group.name} ${action}`, subCmd);
						}
					}
				}
			}
		}

		// ── 4. Deploy all commands to Discord ──
		const token = process.env.DISCORD_TOKEN;
		const clientId = config.clientId;
		const rest = new REST({ version: "10" }).setToken(token);

		try {
			log.info(`🚀 Deploying ${commands.length} commands...`);

			await rest.put(Routes.applicationCommands(clientId), {
				body: commands,
			});

			log.info("✅ Commands deployed successfully!");

			const names = commands.map((c) => c.name);
			log.info(`   Commands: ${names.join(", ")}`);
		} catch (err) {
			log.error("❌ Slash deploy failed:", err);
			throw err;
		}
	},
};
