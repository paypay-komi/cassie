const { getLogger } = require("../lib/logger");

module.exports = {
	name: "interactionCreate",
	async execute(client, interaction) {
		if (!interaction.isChatInputCommand()) return;
		const cmd = client.slashCommands.get(interaction.commandName);
		if (!cmd) return;
		try {
			await cmd.execute(interaction);
		} catch (e) {
			const log = getLogger("SlashCmd");
			log.error(`Error executing /${interaction.commandName}:`, e);
			interaction.reply("Error executing command.");
		}
	},
};
