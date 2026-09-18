const { PermissionsBitField } = require("discord.js");
const { savePendingEntry } = require("../../../lib/restartPending");

module.exports = {
	commandId: "a9b8c7d6-e5f4-3210-fedc-ba9876543210",
	name: "restart",
	aliases: ["reboot", "respawn"],
	description: "Restart all shards.",
	permissions: ["botOwner"],
	category: {
		name: "Bot",
		emoji: "🤖",
		description: "Bot information and configuration.",
		order: 10,
	},
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],

	async execute(message) {
		const confirm = {
			channelId: message.channel.id,
			guildId: message.guild?.id || null,
			userId: message.author.id,
			requestedAt: Date.now(),
		};

		if (message.client.shard) {
			// The shard manager survives the restart and remembers this.
			await message.reply("Restarting all shards...");
			message.client.shard.send({ type: "restartAll", confirm });
			return;
		}

		// Non-sharded: no manager to remember, fall back to the pending file
		// so a startup task confirms after the process comes back up.
		savePendingEntry(confirm);
		await message.reply("Restarting all shards...");
		process.exit(0);
	},
};
