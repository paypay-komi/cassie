const { PermissionsBitField } = require("discord.js");
const db = require("../../../../db");
const { buildMessage } = require("../../../../lib/v2Reply");

module.exports = {

commandId: "a7b8c9d0-e1f2-3456-0123-789012345678",
	name: "allowmath",
	description: "Toggle allowing math expressions (2+2, 5*3, etc.)",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config) return message.reply(buildMessage("Counting isn't set up.", 0xED4245));

		const value = args.shift();
		if (!value) return message.reply(buildMessage(`Allow math is currently \`${config.allowMath ? "on" : "off"}\``, 0x5865F2));

		const newVal = ["on", "true", "yes", "enable"].includes(value.toLowerCase());
		await db.prisma.countingConfig.update({ where: { guildId: message.guild.id }, data: { allowMath: newVal } });
		message.reply(buildMessage(`Allow math ${newVal ? "enabled" : "disabled"}`, newVal ? 0x28A745 : 0xED4245));
	},
};