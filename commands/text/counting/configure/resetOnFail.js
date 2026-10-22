const { PermissionsBitField } = require("discord.js");
const db = require("../../../../db");
const { buildMessage } = require("../../../../lib/v2Reply");

module.exports = {

commandId: "d4e5f6a7-b8c9-0123-def0-456789012345",
	name: "resetonfail",
	description: "Toggle reset on fail (when someone gets the count wrong)",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const config = await db.prisma.countingConfig.findUnique({ where: { guildId: message.guild.id } });
		if (!config) return message.reply(buildMessage("Counting isn't set up.", 0xED4245));

		const value = args.shift();
		if (!value) return message.reply(buildMessage(`Reset on fail is currently \`${config.resetOnFail ? "on" : "off"}\``, 0x5865F2));

		const newVal = ["on", "true", "yes", "enable"].includes(value.toLowerCase());
		await db.prisma.countingConfig.update({ where: { guildId: message.guild.id }, data: { resetOnFail: newVal } });
		message.reply(buildMessage(`Reset on fail ${newVal ? "enabled" : "disabled"}`, newVal ? 0x28A745 : 0xED4245));
	},
};