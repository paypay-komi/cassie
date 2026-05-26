const path = require("path");
const { postCommandsToDbl } = require("../../../utils/postCommandsToDbl");

module.exports = {
	name: "text",
	description: "Reload text commands and repost to DBL",
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

		try {
			const count = await postCommandsToDbl(message.client);
			await message.reply({
				content: `✅ Text commands reloaded on ${results.length} shard(s)! Also posted ${count} commands to DBL.`,
			});
		} catch (err) {
			await message.reply({
				content: `✅ Text commands reloaded on ${results.length} shard(s)! ⚠️ Failed to post to DBL: ${err.message}`,
			});
		}
	},
};
