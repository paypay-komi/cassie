

const { getLogger } = require("../../lib/logger");

module.exports = {
	name: "deploySlashCommands",
	description: "Deploy slash commands on startup",
	needsReadyClient: true,
	async execute(client) {
		const log = getLogger("DeploySlash");
		const deploySlashcommands = require("../../utils/depolySlashcommands");
		const slashCommandsReloaded = await deploySlashcommands(client, {
			global: true,
		});

		log.info(
			`✅ Slash commands deployed on startup: ${slashCommandsReloaded}`,
		);
	},
};
