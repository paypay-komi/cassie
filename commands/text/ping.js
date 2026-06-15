const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { ArgsBuilder } = require("../../lib/argsBuilder");

module.exports = {

commandId: "0bfd59dd-e035-49f6-a928-f980b61f59e3",
	name: "ping",
	description: "Check the bot's latency.",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.EmbedLinks],
	category: "Utility",
	aliases: ["p"],
	// Optional args declaration — generates typed Discord options for /ping
	// Commands without this fall back to a generic string option.
	args: ArgsBuilder.create(),

	async execute(message) {
		const startTime = Date.now();

		// Type 1: user → bot
		const latencyType1 = startTime - message.createdTimestamp;

		// Type 2: gateway heartbeat
		const latencyType2 = Math.round(message.client.ws.ping);

		// Send message (needed for type 3)
		const sent = await message.reply("🏓 Calculating latency...");

		// Type 3: bot → Discord → bot
		const latencyType3 = Date.now() - startTime;

		const embed = new EmbedBuilder()
			.setTitle("🏓 Pong!")
			.setColor("#00AEEF")
			.setDescription(
				"**Latency Measurements**\n" +
					`• Message latency: **${latencyType1}ms**\n` +
					`• API latency: **${latencyType2}ms**\n` +
					`• Round-trip latency: **${latencyType3}ms**`,
			)
			.setFooter({
				text:
					"If the message latency is negative, my system clock is ahead of Discord’s servers.\n" +
					"If the API ping is -1, the shard is still initializing.\n" +
					"If the round‑trip latency is negative,\nthen somehow the message was processed before it was created — which is impossible unless I invented a time machine.",
			});

		await sent.edit({ content: null, embeds: [embed] });
	},
};
