const { PermissionsBitField } = require("discord.js");
const db = require("../../../../db");
const { buildMessage } = require("../../../../lib/v2Reply");

module.exports = {

commandId: "f6a7b8c9-d0e1-2345-f012-678901234567",
	name: "allowdecimals",
	description: "Toggle allowing decimal numbers",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config) return message.reply(buildMessage("Counting isn't set up.", 0xED4245));

		const value = args.shift();
		if (!value) return message.reply(buildMessage(`Allow decimals is currently \`${config.allowDecimals ? "on" : "off"}\``, 0x5865F2));

		const newVal = ["on", "true", "yes", "enable"].includes(value.toLowerCase());
		await db.prisma.countingConfig.update({ where: { guildId: message.guild.id }, data: { allowDecimals: newVal } });
		message.reply(buildMessage(`Allow decimals ${newVal ? "enabled" : "disabled"}`, newVal ? 0x28A745 : 0xED4245));
	},
};