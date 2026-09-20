const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
module.exports = {
	commandId: "c8582e18-05d9-4a00-85f1-d17a1c1d9651",
	name: "admin",
	parent: "antinuke",
	description: "Add or remove an antinuke admin (bypasses all checks)",
	usage: "antinuke admin <add|remove> <@user>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const action = (args[0] || "").toLowerCase();
		const target = message.mentions.users.first();
		if (!target) return message.reply(buildMessage("Mention a user.", 0xe05252));

		const cfg = await automation.ensureAntinukeConfig(prisma, guild.id);
		const list = cfg.admins || [];

		if (action === "add") {
			if (list.includes(target.id)) return message.reply(buildMessage("Already an admin.", 0xe05252));
			await prisma.antinukeConfig.update({ where: { guildId: guild.id }, data: { admins: [...list, target.id] } });
			return message.reply(buildMessage(target.tag + " is now an antinuke admin.", 0x57f287));
		}
		if (action === "remove") {
			if (!list.includes(target.id)) return message.reply(buildMessage("Not an admin.", 0xe05252));
			await prisma.antinukeConfig.update({ where: { guildId: guild.id }, data: { admins: list.filter((id) => id !== target.id) } });
			return message.reply(buildMessage(target.tag + " removed as antinuke admin.", 0x57f287));
		}

		return message.reply(buildMessage("Usage: `antinuke admin <add|remove> <@user>`", 0xe05252));
	},
};