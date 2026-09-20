const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
module.exports = {
	commandId: "435503ba-1b1a-4a5a-a557-b804d435cd0c",
	name: "regex",
	parent: "automod",
	description: "Add, remove, or list custom regex filters",
	usage: "automod regex <add|remove|list> [name] [pattern]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const action = (args[0] || "").toLowerCase();

		const cfg = await automation.ensureAutomodConfig(prisma, guild.id);

		if (action === "list") {
			const regexes = await prisma.automodRegex.findMany({ where: { guildId: guild.id } });
			if (!regexes.length) return message.reply(buildMessage("No custom regex filters.", 0xe05252));
			const lines = regexes.map(function(r) {
				return (r.enabled ? "🟢 " : "🔴 ") + "**" + r.name + "** — `" + r.pattern + "`";
			});
			return message.reply(buildMessage("## Regex Filters\n" + lines.join("\n"), 0x5865f2));
		}

		if (action === "remove") {
			const name = args[1];
			if (!name) return message.reply(buildMessage("Provide the filter name to remove.", 0xe05252));
			await prisma.automodRegex.deleteMany({ where: { configId: guild.id, name: name } });
			return message.reply(buildMessage("Removed regex filter **" + name + "**.", 0x57f287));
		}

		if (action === "add") {
			const name = args[1];
			const pattern = args[2];
			if (!name || !pattern) return message.reply(buildMessage("Usage: `automod regex add <name> <pattern>`", 0xe05252));
			try { new RegExp(pattern); } catch (e) { return message.reply(buildMessage("Invalid regex: " + e.message, 0xe05252)); }
			await prisma.automodRegex.upsert({
				where: { configId_name: { configId: guild.id, name } },
				create: { configId: guild.id, name, pattern },
				update: { pattern },
			});
			return message.reply(buildMessage("Regex **" + name + "** saved.", 0x57f287));
		}

		return message.reply(buildMessage("Usage: `automod regex <add|remove|list>`", 0xe05252));
	},
};