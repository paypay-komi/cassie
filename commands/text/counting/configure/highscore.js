const { PermissionsBitField } = require("discord.js");
const db = require("../../../../db");
const { buildMessage } = require("../../../../lib/v2Reply");

module.exports = {

commandId: "e1f2a3b4-c5d6-7890-4567-123456789012",
	name: "highscore",
	description: "Set the high score",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config) return message.reply(buildMessage("Counting isn't set up.", 0xED4245));

		const value = args.shift();
		if (!value) return message.reply(buildMessage(`High score: \`${config.highScore}\``, 0x5865F2));

		const num = parseInt(value);
		if (isNaN(num) || num < 0) return message.reply(buildMessage("Must be a positive number.", 0xED4245));

		await db.prisma.countingConfig.update({ where: { guildId: message.guild.id }, data: { highScore: BigInt(num) } });
		message.reply(buildMessage(`High score set to \`${num}\``, 0x28A745));
	},
};