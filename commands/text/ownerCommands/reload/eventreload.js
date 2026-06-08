const { PermissionsBitField } = require("discord.js");
const path = require("path");

module.exports = {

commandId: "024a6d03-dde0-4323-89ab-db00b20f08d7",
	name: "event",
	description: "Reload event handlers",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	permissions: ["botOwner"],
	parent: "reload",

	async execute(message) {
		const filePath = path.join(process.cwd(), "startup-lib", "reloadEvents.js");

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
