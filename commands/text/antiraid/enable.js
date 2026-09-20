const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
module.exports = {
	commandId: "1e1a1f5f-0d7c-42b2-9b1f-6aabf381fec8",
	name: "enable",
	parent: "antiraid",
	description: "Enable or disable antiraid",
	usage: "antiraid enable <on|off>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const value = (args[0] || "").toLowerCase();
		const on = ["on", "true", "yes", "enable"].includes(value);

		await automation.ensureAntiraidConfig(prisma, guild.id);
		await prisma.antiraidConfig.update({ where: { guildId: guild.id }, data: { enabled: on } });

		return message.reply(buildMessage("Antiraid **" + (on ? "enabled" : "disabled") + "**.", on ? 0x57f287 : 0xe05252));
	},
};