const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
module.exports = {
	commandId: "b49ae84f-5fbb-44c7-a03e-dbf8959113a2",
	name: "enable",
	parent: "automod",
	description: "Enable or disable automod",
	usage: "automod enable <on|off>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const value = (args[0] || "").toLowerCase();
		const on = ["on", "true", "yes", "enable"].includes(value);

		await automation.ensureAutomodConfig(prisma, guild.id);
		await prisma.automodConfig.update({ where: { guildId: guild.id }, data: { enabled: on } });

		return message.reply(buildMessage("Automod **" + (on ? "enabled" : "disabled") + "**.", on ? 0x57f287 : 0xe05252));
	},
};