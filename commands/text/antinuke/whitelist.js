const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
module.exports = {
	commandId: "b4f7e649-6a24-4c19-9910-5af3f1fe1284",
	name: "whitelist",
	parent: "antinuke",
	description: "Whitelist or unwhitelist a user from antinuke",
	usage: "antinuke whitelist <add|remove> <@user>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const action = (args[0] || "").toLowerCase();
		const target = message.mentions.users.first();
		if (!target) return message.reply(buildMessage("Mention a user.", 0xe05252));

		const cfg = await automation.ensureAntinukeConfig(prisma, guild.id);
		const list = cfg.whitelisted || [];

		if (action === "add") {
			if (list.includes(target.id)) return message.reply(buildMessage("Already whitelisted.", 0xe05252));
			await prisma.antinukeConfig.update({ where: { guildId: guild.id }, data: { whitelisted: [...list, target.id] } });
			return message.reply(buildMessage(target.tag + " whitelisted.", 0x57f287));
		}
		if (action === "remove") {
			if (!list.includes(target.id)) return message.reply(buildMessage("Not whitelisted.", 0xe05252));
			await prisma.antinukeConfig.update({ where: { guildId: guild.id }, data: { whitelisted: list.filter((id) => id !== target.id) } });
			return message.reply(buildMessage(target.tag + " removed from whitelist.", 0x57f287));
		}

		return message.reply(buildMessage("Usage: `antinuke whitelist <add|remove> <@user>`", 0xe05252));
	},
};