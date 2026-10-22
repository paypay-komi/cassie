const { PermissionsBitField } = require("discord.js");
const db = require("../../../../db");
const { buildMessage } = require("../../../../lib/v2Reply");

module.exports = {

commandId: "b8c9d0e1-f2a3-4567-1234-890123456789",
	name: "cooldown",
	description: "Set anti-spam cooldown in milliseconds (0 = off)",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config) return message.reply(buildMessage("Counting isn't set up.", 0xED4245));

		const value = args.shift();
		if (!value) return message.reply(buildMessage(`Cooldown is currently \`${config.cooldownMs}ms\``, 0x5865F2));

		const ms = parseInt(value);
		if (isNaN(ms) || ms < 0 || ms > 60000) return message.reply(buildMessage("Must be a number between 0 and 60000.", 0xED4245));

		await db.prisma.countingConfig.update({ where: { guildId: message.guild.id }, data: { cooldownMs: ms } });
		message.reply(buildMessage(`Cooldown set to \`${ms}ms\``, 0x28A745));
	},
};