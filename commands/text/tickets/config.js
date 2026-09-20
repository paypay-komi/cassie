const { PermissionsBitField } = require("discord.js");
const tickets = require("../../../lib/tickets");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {
	commandId: "3e1d35ce-7adb-462a-a239-04b166002655",
	name: "config",
	parent: "tickets",
	description: "View or configure ticket settings",
	usage: "tickets config <setting> <value>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const cfg = await tickets.ensureConfig(prisma, guild.id);
		const setting = (args[0] || "").toLowerCase();
		const value = args.slice(1).join(" ");

		if (!setting) {
			const supportRole = cfg.supportRoleId ? guild.roles.cache.get(cfg.supportRoleId) : null;
			const logChannel = cfg.logChannelId ? guild.channels.cache.get(cfg.logChannelId) : null;
			const category = cfg.categoryChannelId ? guild.channels.cache.get(cfg.categoryChannelId) : null;
			const lines = [
				`**Enabled:** ${cfg.enabled ? "🟢 Yes" : "🔴 No"}`,
				`**Support role:** ${supportRole ? `${supportRole}` : "Not set"}`,
				`**Category:** ${category ? `${category}` : "Not set"}`,
				`**Log channel:** ${logChannel ? `${logChannel}` : "Not set"}`,
				`**Max open:** ${cfg.maxOpen || "Unlimited"}`,
			];
			return message.reply(buildMessage("## 🎫 Ticket Config\n" + lines.join("\n"), 0x5865f2));
		}

		const bool = (v) => ["on", "true", "yes", "enable"].includes(v);
		const off = (v) => ["off", "false", "no", "disable"].includes(v);

		if (setting === "enable" || setting === "enabled") {
			await prisma.ticketConfig.update({ where: { guildId: guild.id }, data: { enabled: bool(value) || !off(value) } });
			return message.reply(buildMessage("Tickets **" + (bool(value) || !off(value) ? "enabled" : "disabled") + "**.", 0x57f287));
		}
		if (setting === "role" || setting === "support") {
			const role = message.mentions.roles.first() || (value && /^\d+$/.test(value) ? guild.roles.cache.get(value) : null);
			if (!role) return message.reply(buildMessage("Mention a role or provide a role ID.", 0xe05252));
			await prisma.ticketConfig.update({ where: { guildId: guild.id }, data: { supportRoleId: role.id } });
			return message.reply(buildMessage(`Support role set to ${role}.`, 0x57f287));
		}
		if (setting === "category") {
			const ch = message.mentions.channels.first() || (value && /^\d+$/.test(value) ? guild.channels.cache.get(value) : null);
			if (!ch) return message.reply(buildMessage("Mention a category channel.", 0xe05252));
			await prisma.ticketConfig.update({ where: { guildId: guild.id }, data: { categoryChannelId: ch.id } });
			return message.reply(buildMessage(`Category set to ${ch}.`, 0x57f287));
		}
		if (setting === "log") {
			const ch = off(value) ? null : (message.mentions.channels.first() || null);
			await prisma.ticketConfig.update({ where: { guildId: guild.id }, data: { logChannelId: ch?.id || null } });
			return message.reply(buildMessage(ch ? `Log channel set to ${ch}.` : "Log channel cleared.", 0x57f287));
		}
		if (setting === "max") {
			const n = parseInt(value, 10);
			await prisma.ticketConfig.update({ where: { guildId: guild.id }, data: { maxOpen: n > 0 ? n : null } });
			return message.reply(buildMessage(`Max open tickets set to ${n > 0 ? n : "unlimited"}.`, 0x57f287));
		}

		return message.reply(buildMessage("Options: `enable`, `role`, `category`, `log`, `max`", 0xe05252));
	},
};