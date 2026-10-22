const { PermissionsBitField } = require("discord.js");
const db = require("../../../db");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "f2a3b4c5-d6e7-8901-5678-234567890123",
	name: "reset",
	description: "Reset the count to 0",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "counting",
	aliases: ["clear"],

	async execute(message) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config || !config.enabled) return message.reply(buildMessage("Counting isn't set up.", 0xED4245));

		await db.prisma.countingConfig.update({
			where: { guildId: message.guild.id },
			data: { currentCount: 0n, lastCounterId: null, lastCountAt: null },
		});

		message.reply(buildMessage("Count reset to **0**", 0xFAA61A));
	},
};