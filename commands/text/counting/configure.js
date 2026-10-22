const { PermissionsBitField } = require("discord.js");
const db = require("../../../db");
const { buildMessageBlocks } = require("../../../lib/v2Reply");

function fmtCount(n) {
	if (!n) return "0";
	return BigInt(n).toLocaleString();
}

module.exports = {

commandId: "c3d4e5f6-a7b8-9012-cdef-345678901234",
	name: "configure",
	description: "View or change counting channel settings",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],

	parent: "counting",
	aliases: ["config", "settings"],
	async execute(message, args) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config || !config.enabled || !config.channelId) return message.reply(buildMessage("Counting isn't set up. Use `c.counting create #channel` first.", 0xED4245));

		const channel = message.guild.channels.cache.get(config.channelId);
		const lastCounter = config.lastCounterId ? `<@${config.lastCounterId}>` : "—";

		const blocks = [
			`## Counting Config\nChannel: ${channel || "deleted"}\nLast counter: ${lastCounter}`,
			`**Current Count:** ${fmtCount(config.currentCount)}  •  **High Score:** ${fmtCount(config.highScore)}`,
			`**Reset on Fail:** ${config.resetOnFail ? "Yes" : "No"}  •  **Delete Wrong:** ${config.deleteWrong ? "Yes" : "No"}`,
			`**Allow Decimals:** ${config.allowDecimals ? "Yes" : "No"}  •  **Allow Math:** ${config.allowMath ? "Yes" : "No"}`,
			`**Cooldown:** ${config.cooldownMs}ms`,
			`Settings: ${Object.keys(this.subcommands).join(", ")} | Usage: \`c.counting configure <setting> [value]\``,
		];

		message.reply(buildMessageBlocks(blocks, 0x5865F2));
	},
};