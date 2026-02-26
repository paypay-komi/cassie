const path = require("path");

module.exports = {
	name: "event",
	description: "Reload event handlers",
	permissions: ["botOwner"],
	parent: "reload",

	async execute(message) {
		const filePath = path.join(process.cwd(), "utils", "reloadEvents.js");

		await message.client.shard.broadcastEval(
			(client, { file }) => {
				delete require.cache[require.resolve(file)];
				const reloadEvents = require(file);
				return reloadEvents(client);
			},
			{
				context: { file: filePath },
			},
		);

		await message.reply({
			content: "✅ Event handlers reloaded on all shards!",
		});
	},
};
