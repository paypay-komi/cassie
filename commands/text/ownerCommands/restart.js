const { PermissionsBitField } = require("discord.js");

module.exports = {
	commandId: "a9b8c7d6-e5f4-3210-fedc-ba9876543210",
	name: "restart",
	aliases: ["reboot", "respawn"],
	description: "Restart all shards.",
	permissions: ["botOwner"],
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],

	async execute(message) {
		await message.reply("Restarting all shards...");

		if (message.client.shard) {
			message.client.shard.send({ type: "restartAll" });
		} else {
			process.exit(0);
		}
	},
};
