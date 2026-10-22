const { PermissionsBitField } = require("discord.js");
const db = require("../../../../db");
const { buildMessage } = require("../../../../lib/v2Reply");

module.exports = {

commandId: "d0e1f2a3-b4c5-6789-3456-012345678901",
	name: "current",
	description: "Set the current count",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config) return message.reply(buildMessage("Counting isn't set up.", 0xED4245));

		const value = args.shift();
		if (!value) return message.reply(buildMessage(`Current count: \`${config.currentCount}\``, 0x5865F2));

		const num = parseInt(value);
		if (isNaN(num) || num < 0) return message.reply(buildMessage("Must be a positive number.", 0xED4245));

		await db.prisma.countingConfig.update({ where: { guildId: message.guild.id }, data: { currentCount: BigInt(num) } });
		message.reply(buildMessage(`Current count set to \`${num}\``, 0x28A745));
	},
};