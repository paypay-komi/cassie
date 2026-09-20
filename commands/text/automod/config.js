const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
module.exports = {
	commandId: "f8283c69-e351-497b-83ee-acdf11cd5266",
	name: "config",
	parent: "automod",
	description: "View or configure automod global settings",
	usage: "automod config [setting] [value]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const cfg = await automation.ensureAutomodConfig(prisma, guild.id);
		const setting = (args[0] || "").toLowerCase();
		const value = args.slice(1).join(" ");

		if (!setting) {
			const filters = cfg.filters || [];
			const enabled = filters.filter(function(f) { return f.enabled; });
			const lines = [
				"**Enabled:** " + (cfg.enabled ? "Yes" : "No"),
				"**Default punishment:** " + cfg.punishment,
				"**Strikes:** " + (cfg.strikesEnabled ? "On (" + cfg.maxStrikes + " max, " + cfg.strikeDecayHours + "h decay)" : "Off"),
				"**Active filters:** " + enabled.map(function(f) { return f.type; }).join(", ") || "None",
			];
			return message.reply(buildMessage("## Automod Config\n" + lines.join("\n"), 0x5865f2));
		}

		if (setting === "punishment") {
			const valid = ["delete", "warn", "timeout", "kick", "ban"];
			if (!valid.includes(value)) return message.reply(buildMessage("Valid: " + valid.join(", "), 0xe05252));
			await prisma.automodConfig.update({ where: { guildId: guild.id }, data: { punishment: value } });
			return message.reply(buildMessage("Default punishment set to **" + value + "**.", 0x57f287));
		}
		if (setting === "strikes") {
			const on = ["on", "true", "yes"].includes(value);
			await prisma.automodConfig.update({ where: { guildId: guild.id }, data: { strikesEnabled: on } });
			return message.reply(buildMessage("Strikes **" + (on ? "enabled" : "disabled") + "**.", 0x57f287));
		}
		if (setting === "maxstrikes") {
			const n = parseInt(value, 10);
			if (!n) return message.reply(buildMessage("Provide a number.", 0xe05252));
			await prisma.automodConfig.update({ where: { guildId: guild.id }, data: { maxStrikes: n } });
			return message.reply(buildMessage("Max strikes set to **" + n + "**.", 0x57f287));
		}
		if (setting === "log") {
			const ch = message.mentions.channels.first();
			await prisma.automodConfig.update({ where: { guildId: guild.id }, data: { logChannelId: ch ? ch.id : null } });
			return message.reply(buildMessage(ch ? "Log channel set to " + ch + "." : "Log channel cleared.", 0x57f287));
		}

		return message.reply(buildMessage("Options: punishment, strikes, maxstrikes, log", 0xe05252));
	},
};