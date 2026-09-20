const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const vm = require("../../../lib/voiceMaster");
module.exports = {
	commandId: "46af3056-8cb1-4af4-8674-e15f1b22f057",
	name: "config",
	parent: "vm",
	description: "View or configure VoiceMaster settings",
	usage: "vm config [setting] [value]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const cfg = await vm.ensureConfig(prisma, guild.id);
		const setting = (args[0] || "").toLowerCase();
		const value = args.slice(1).join(" ");

		if (!setting) {
			const cat = cfg.categoryId ? guild.channels.cache.get(cfg.categoryId) : null;
			const lines = [
				"**Category:** " + (cat ? "" + cat : "Not set"),
				"**Interface:** " + (cfg.interfaceEnabled ? "🟢 On" : "🔴 Off"),
				"**Default bitrate:** " + cfg.defaultBitrate + "kbps",
				"**Default name:** " + cfg.defaultName,
				"**Temporary:** " + (cfg.temporary ? "🟢 Yes" : "🔴 No"),
				"**Default role:** " + (cfg.defaultRoleId ? "<@&" + cfg.defaultRoleId + ">" : "None"),
			];
			return message.reply(buildMessage("## 🎙️ VoiceMaster Config\n" + lines.join("\n"), 0x5865f2));
		}

		const bool = function(v) { return ["on","true","yes","enable"].indexOf(v) !== -1; };
		const off = function(v) { return ["off","false","no","disable"].indexOf(v) !== -1; };

		if (setting === "category") {
			const ch = message.mentions.channels.first() || (value && guild.channels.cache.get(value.replace(/[<#>]/g, "")));
			if (!ch || ch.type !== 4) return message.reply(buildMessage("Mention a **category** channel.", 0xe05252));
			await prisma.voiceMasterConfig.update({ where: { guildId: guild.id }, data: { categoryId: ch.id } });
			return message.reply(buildMessage("Category set to " + ch + ".", 0x57f287));
		}
		if (setting === "interface") {
			const on = bool(value) || !off(value);
			await prisma.voiceMasterConfig.update({ where: { guildId: guild.id }, data: { interfaceEnabled: on } });
			return message.reply(buildMessage("Interface **" + (on ? "enabled" : "disabled") + "**.", 0x57f287));
		}
		if (setting === "bitrate") {
			const n = parseInt(value, 10);
			if (n < 8 || n > 384) return message.reply(buildMessage("Bitrate must be 8–384.", 0xe05252));
			await prisma.voiceMasterConfig.update({ where: { guildId: guild.id }, data: { defaultBitrate: n } });
			return message.reply(buildMessage("Default bitrate set to **" + n + "kbps**.", 0x57f287));
		}
		if (setting === "name") {
			if (!value) return message.reply(buildMessage("Provide a name template. Use `{user}` for the creator's name.", 0xe05252));
			await prisma.voiceMasterConfig.update({ where: { guildId: guild.id }, data: { defaultName: value } });
			return message.reply(buildMessage("Default name set to **" + value + "**.", 0x57f287));
		}
		if (setting === "temporary" || setting === "temp") {
			const on = bool(value) || !off(value);
			await prisma.voiceMasterConfig.update({ where: { guildId: guild.id }, data: { temporary: on } });
			return message.reply(buildMessage("Auto-delete empty channels **" + (on ? "enabled" : "disabled") + "**.", 0x57f287));
		}
		if (setting === "role") {
			const role = message.mentions.roles.first() || (value && guild.roles.cache.get(value.replace(/[<@&>]/g, "")));
			if (!role) return message.reply(buildMessage("Mention a role, or `off` to clear.", 0xe05252));
			await prisma.voiceMasterConfig.update({ where: { guildId: guild.id }, data: { defaultRoleId: role.id } });
			return message.reply(buildMessage("Default role set to " + role + ".", 0x57f287));
		}

		return message.reply(buildMessage("Options: category, interface, bitrate, name, temporary, role", 0xe05252));
	},
};