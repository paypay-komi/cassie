const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const levels = require("../../../lib/levels");

module.exports = {

commandId: "eb91ec4c-37f9-4b77-a619-824c98bdf7d9",
	name: "config",
	parent: "levels",
	description: "Configure the leveling system (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;
		const setting = (args[0] || "").toLowerCase();
		const value = args.slice(1).join(" ");

		const config = await levels.getConfig(prisma, guildId);

		if (!setting) {
			const ch = config.channelId
				? `<#${config.channelId}>`
				: "Not set";
			return message.reply(
				buildMessage(
					[
						"## ⚙️ Levels",
						`**Text XP:** ${config.textEnabled ? "🟢 On" : "🔴 Off"}`,
						`**Voice XP:** ${config.voiceEnabled ? "🟢 On" : "🔴 Off"}`,
						`**Announce channel:** ${ch}`,
						`**DM on level up:** ${config.dmLevelUp ? "Yes" : "No"}`,
						`**Stack roles:** ${config.stackRoles ? "Yes" : "No"}`,
						`**Text multiplier:** ${config.textMultiplier}x`,
						"",
						"**Options:** `text`, `voice`, `channel`, `dm`, `stack`, `multiplier`",
					].join("\n"),
					0x5865f2,
				),
			);
		}

		const bool = (v) => ["on", "true", "yes", "enable"].includes(v);
		const off = (v) => ["off", "false", "no", "disable"].includes(v);

		if (setting === "text") {
			if (!bool(value) && !off(value))
				return message.reply(buildMessage("Use `text on` or `text off`."));
			await prisma.levelConfig.update({
				where: { guildId },
				data: { textEnabled: bool(value) },
			});
			return message.reply(buildMessage(`Text XP **${bool(value) ? "on" : "off"}**.`));
		}

		if (setting === "voice") {
			if (!bool(value) && !off(value))
				return message.reply(buildMessage("Use `voice on` or `voice off`."));
			await prisma.levelConfig.update({
				where: { guildId },
				data: { voiceEnabled: bool(value) },
			});
			return message.reply(buildMessage(`Voice XP **${bool(value) ? "on" : "off"}**.`));
		}

		if (setting === "channel") {
			if (off(value)) {
				await prisma.levelConfig.update({
					where: { guildId },
					data: { channelId: null },
				});
				return message.reply(buildMessage("Level-up announcements disabled."));
			}
			const ch = message.mentions.channels.first();
			if (!ch)
				return message.reply(buildMessage("Mention a channel, or use `off`."));
			await prisma.levelConfig.update({
				where: { guildId },
				data: { channelId: ch.id },
			});
			return message.reply(buildMessage(`Level-up announcements set to ${ch}.`));
		}

		if (setting === "dm") {
			if (!bool(value) && !off(value))
				return message.reply(buildMessage("Use `dm on` or `dm off`."));
			await prisma.levelConfig.update({
				where: { guildId },
				data: { dmLevelUp: bool(value) },
			});
			return message.reply(buildMessage(`DM on level up **${bool(value) ? "on" : "off"}**.`));
		}

		if (setting === "stack") {
			if (!bool(value) && !off(value))
				return message.reply(buildMessage("Use `stack on` or `stack off`."));
			await prisma.levelConfig.update({
				where: { guildId },
				data: { stackRoles: bool(value) },
			});
			return message.reply(buildMessage(`Stack reward roles **${bool(value) ? "on" : "off"}**.`));
		}

		if (setting === "multiplier") {
			const n = parseFloat(value);
			if (isNaN(n) || n <= 0)
				return message.reply(buildMessage("Provide a positive number."));
			await prisma.levelConfig.update({
				where: { guildId },
				data: { textMultiplier: n },
			});
			return message.reply(buildMessage(`Global text XP multiplier set to **${n}x**.`));
		}

		return message.reply(
			buildMessage(
				`Unknown option \`${setting}\`. Use: text, voice, channel, dm, stack, multiplier.`,
			),
		);
	},
};
