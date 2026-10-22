const { PermissionsBitField } = require("discord.js");
const db = require("../../../../db");
const { buildMessage } = require("../../../../lib/v2Reply");

module.exports = {

commandId: "e5f6a7b8-c9d0-1234-ef01-567890123456",
	name: "deletewrong",
	description: "Toggle deleting wrong count messages",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config) return message.reply(buildMessage("Counting isn't set up.", 0xED4245));

		const value = args.shift();
		if (!value) return message.reply(buildMessage(`Delete wrong is currently \`${config.deleteWrong ? "on" : "off"}\``, 0x5865F2));

		const newVal = ["on", "true", "yes", "enable"].includes(value.toLowerCase());
		await db.prisma.countingConfig.update({ where: { guildId: message.guild.id }, data: { deleteWrong: newVal } });
		message.reply(buildMessage(`Delete wrong ${newVal ? "enabled" : "disabled"}`, newVal ? 0x28A745 : 0xED4245));
	},
};