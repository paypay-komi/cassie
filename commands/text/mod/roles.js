const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

const KINDS = { jail: "jailConfig", imute: "imuteConfig", rmute: "rmuteConfig" };

module.exports = {

commandId: "733cdd39-7f18-427e-a7b8-faba51487136",
	name: "roles",
	parent: "mod",
	description: "Configure jail/imute/rmute roles and the mod log channel",
	usage: "mod roles | mod roles <jail|imute|rmute|log> <role|channel|off>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		if (!args.length) {
			const [jail, imute, rmute] = await Promise.all([
				prisma.jailConfig.findUnique({ where: { guildId: guild.id } }),
				prisma.imuteConfig.findUnique({ where: { guildId: guild.id } }),
				prisma.rmuteConfig.findUnique({ where: { guildId: guild.id } }),
			]);
			const lines = [
				"## 🎭 Mod roles",
				`**Jail role:** ${jail?.roleId ? `<@&${jail.roleId}>` : "*not set*"}`,
				`**Imute role:** ${imute?.roleId ? `<@&${imute.roleId}>` : "*not set*"}`,
				`**Rmute role:** ${rmute?.roleId ? `<@&${rmute.roleId}>` : "*not set*"}`,
				`**Log channel:** ${jail?.logChannelId ? `<#${jail.logChannelId}>` : "*not set*"}`,
			];
			return message.reply(buildMessage(lines.join("\n"), 0x5865f2));
		}

		const kind = args[0].toLowerCase();
		if (!KINDS[kind] && kind !== "log")
			return message.reply(buildMessage("Usage: `mod roles <jail|imute|rmute|log> <role|channel|off>`"));

		const value = args[1];

		if (kind === "log") {
			const targetChannel = value === "off" ? null : message.mentions.channels.first()?.id || (value && /^\d+$/.test(value) && value) || null;
			for (const key of Object.values(KINDS)) {
				await prisma[key].upsert({
					where: { guildId: guild.id },
					create: { guildId: guild.id, logChannelId: targetChannel },
					update: { logChannelId: targetChannel },
				});
			}
			return message.reply(buildMessage(targetChannel ? `Log channel set to <#${targetChannel}>.` : "Log channel cleared.", 0x57f287));
		}

		const key = KINDS[kind];
		const targetRole = value === "off" ? null : message.mentions.roles.first()?.id || (value && /^\d+$/.test(value) && value) || null;
		if (value && value !== "off" && !targetRole)
			return message.reply(buildMessage("Mention a role or provide a role ID."));
		if (targetRole && guild.roles.cache.get(targetRole)?.managed)
			return message.reply(buildMessage("Cannot use a managed role (e.g. bot role)."));

		await prisma[key].upsert({
			where: { guildId: guild.id },
			create: { guildId: guild.id, roleId: targetRole },
			update: { roleId: targetRole },
		});

		return message.reply(buildMessage(
			targetRole ? `${kind} role set to <@&${targetRole}>.` : `${kind} role cleared.`,
			0x57f287,
		));
	},
};