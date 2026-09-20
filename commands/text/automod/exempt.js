const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
module.exports = {
	commandId: "8d339b68-0b6d-4f9f-b752-8ca869a5b905",
	name: "exempt",
	parent: "automod",
	description: "Exempt a user, channel, or role from automod",
	usage: "automod exempt <add|remove> <user|channel|role> <target>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const action = (args[0] || "").toLowerCase();
		const kind = (args[1] || "").toLowerCase();

		if (!["add", "remove"].includes(action) || !["user", "channel", "role"].includes(kind)) {
			return message.reply(buildMessage("Usage: `automod exempt <add|remove> <user|channel|role> <target>`", 0xe05252));
		}

		const cfg = await automation.ensureAutomodConfig(prisma, guild.id);
		const data = { configId: guild.id };

		if (kind === "user") {
			const target = message.mentions.users.first();
			if (!target) return message.reply(buildMessage("Mention a user.", 0xe05252));
			data.userId = target.id;
		} else if (kind === "channel") {
			const target = message.mentions.channels.first();
			if (!target) return message.reply(buildMessage("Mention a channel.", 0xe05252));
			data.channelId = target.id;
		} else if (kind === "role") {
			const target = message.mentions.roles.first();
			if (!target) return message.reply(buildMessage("Mention a role.", 0xe05252));
			data.roleId = target.id;
		}

		if (action === "add") {
			await prisma.automodExemption.create({ data });
			return message.reply(buildMessage("Exemption added.", 0x57f287));
		}
		if (action === "remove") {
			const where = { configId: guild.id };
			if (data.userId) where.userId = data.userId;
			if (data.channelId) where.channelId = data.channelId;
			if (data.roleId) where.roleId = data.roleId;
			await prisma.automodExemption.deleteMany({ where });
			return message.reply(buildMessage("Exemption removed.", 0x57f287));
		}
	},
};