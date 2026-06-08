const { PermissionsBitField } = require("discord.js");
const path = require("path");

module.exports = {

commandId: "d74c45a0-f716-49cf-adba-e74da57e5929",
	name: "slash",
	description: "Reload slash commands",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	permissions: ["botOwner"],
	parent: "reload",

	async execute(message) {
		const filePath = path.join(
			process.cwd(),
			"startup-lib",
			"reloadSlashcommands.js",
		);

		const results = await message.client.shard.broadcastEval(
			(client, { file }) => {
				try {
					delete require.cache[require.resolve(file)];
					const reloadSlashCommands = require(file);
					return reloadSlashCommands(client);
				} catch (err) {
					return `Error: ${err.message}`;
				}
			},
			{
				context: { file: filePath },
			},
		);

		await message.reply({
			content: `✅ Slash commands reloaded on ${results.length} shard(s)!`,
		});
	},
};
