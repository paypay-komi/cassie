

module.exports = {
	name: "deploySlashCommands",
	description: "Deploy slash commands on startup",
	needsReadyClient: true,
	async execute(client) {
		const deploySlashcommands = require("../../utils/depolySlashcommands");
		const slashCommandsReloaded = await deploySlashcommands(client, {
			global: true,
		});

		console.log(
			`✅ Slash commands deployed on startup: ${slashCommandsReloaded}`,
		);
	},
};
