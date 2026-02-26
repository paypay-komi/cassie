const path = require("path");

module.exports = {
	name: "slash",
	description: "Reload slash commands",
	permissions: ["botOwner"],
	parent: "reload",

	async execute(message) {
		const filePath = path.join(
			process.cwd(),
			"utils",
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
