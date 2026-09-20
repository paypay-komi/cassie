const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
module.exports = {
	commandId: "19bc7975-fc8e-4408-be04-a56af0fffae1",
	name: "lockdown",
	parent: "antiraid",
	description: "Toggle lockdown mode (blocks all new joins from chatting)",
	usage: "antiraid lockdown <on|off>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const value = (args[0] || "").toLowerCase();
		const on = ["on", "true", "yes"].includes(value);

		await automation.ensureAntiraidConfig(prisma, guild.id);
		await prisma.antiraidConfig.update({ where: { guildId: guild.id }, data: { lockdown: on } });

		if (on) {
			await guild.roles.everyone.setPermissions(
				guild.roles.everyone.permissions.remove("SendMessages"),
				"Antiraid lockdown",
			).catch(() => {});
		} else {
			await guild.roles.everyone.setPermissions(
				guild.roles.everyone.permissions.add("SendMessages"),
				"Antiraid lockdown lifted",
			).catch(() => {});
		}

		return message.reply(buildMessage("Lockdown **" + (on ? "activated" : "lifted") + "**.", on ? 0xe05252 : 0x57f287));
	},
};