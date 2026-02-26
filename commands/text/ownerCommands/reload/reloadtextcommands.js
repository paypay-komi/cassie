const path = require("path");

module.exports = {
	name: "text",
	description: "Reload text commands",
	permissions: ["botOwner"],
	parent: "reload",

	async execute(message) {
		const filePath = path.join(
			process.cwd(),
			"utils",
			"reloadTextcommands.js",
		);

		const results = await message.client.shard.broadcastEval(
			async (client, { file }) => {
				try {
					delete require.cache[require.resolve(file)];
					const reloadTextCommands = require(file);
					return await reloadTextCommands(client);
				} catch (err) {
					return { error: err.message };
				}
			},
			{
				context: { file: filePath },
			},
		);

		await message.reply({
			content: `✅ Text commands reloaded on ${results.length} shard(s)!`,
		});
	},
};
