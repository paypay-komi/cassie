const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
module.exports = {
	commandId: "dad072ac-6974-432d-baa0-0be3f83a24bb",
	name: "enable",
	parent: "antinuke",
	description: "Enable or disable antinuke",
	usage: "antinuke enable <on|off>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const value = (args[0] || "").toLowerCase();
		const on = ["on", "true", "yes", "enable"].includes(value);

		await automation.ensureAntinukeConfig(prisma, guild.id);
		await prisma.antinukeConfig.update({ where: { guildId: guild.id }, data: { enabled: on } });

		return message.reply(buildMessage("Antinuke **" + (on ? "enabled" : "disabled") + "**.", on ? 0x57f287 : 0xe05252));
	},
};