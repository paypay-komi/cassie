const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "7a08aaad-a0b6-4ebd-bf74-1fde88cff0a5",
	name: "config",
	parent: "invites",
	description: "Configure invite tracking (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;
		const setting = (args[0] || "").toLowerCase();
		const value = args.slice(1).join(" ");

		const config = await prisma.guildInviteConfig.upsert({
			where: { guildId },
			update: {},
			create: { guildId },
		});

		if (!setting) {
			const ch = config.channelId
				? `<#${config.channelId}>`
				: "Not set";
			return message.reply(
				buildMessage(
					[
						"## ⚙️ Invite Tracking",
						`**Tracking:** ${config.trackingEnabled ? "🟢 On" : "🔴 Off"}`,
						`**Join channel:** ${ch}`,
						`**Message:** ${config.message ? "Custom" : "Default"}`,
						`**Deduct on leave:** ${config.deductOnLeave ? "Yes" : "No"}`,
						`**Fake account age:** ${config.fakeAccountDays} day(s)`,
						"",
						"**Options:** `channel`, `message`, `fakedays`, `deduct`, `toggle`",
					].join("\n"),
					0x5865f2,
				),
			);
		}

		if (setting === "channel") {
			if (value.toLowerCase() === "off") {
				await prisma.guildInviteConfig.update({
					where: { guildId },
					data: { channelId: null },
				});
				return message.reply(buildMessage("Join announcements disabled."));
			}
			const ch = message.mentions.channels.first();
			if (!ch) return message.reply(buildMessage("Mention a channel, or use `off`."));
			await prisma.guildInviteConfig.update({
				where: { guildId },
				data: { channelId: ch.id },
			});
			return message.reply(buildMessage(`Join announcements set to ${ch}.`));
		}

		if (setting === "message") {
			if (!value)
				return message.reply(
					buildMessage(
						"Provide a message. Tokens: `{user}` `{user.tag}` `{inviter}` `{invites}` `{guild}` `{code}` — or `off` for the default.",
					),
				);
			await prisma.guildInviteConfig.update({
				where: { guildId },
				data: { message: value.toLowerCase() === "off" ? null : value },
			});
			return message.reply(buildMessage("Join message updated."));
		}

		if (setting === "fakedays") {
			const n = parseInt(value, 10);
			if (isNaN(n) || n < 0)
				return message.reply(
					buildMessage("Provide a number of days (0 disables fake detection)."),
				);
			await prisma.guildInviteConfig.update({
				where: { guildId },
				data: { fakeAccountDays: n },
			});
			return message.reply(
				buildMessage(`Fake-account age threshold set to **${n}** day(s).`),
			);
		}

		if (setting === "deduct") {
			const on = ["on", "true", "yes", "enable"].includes(
				value.toLowerCase(),
			);
			const off = ["off", "false", "no", "disable"].includes(
				value.toLowerCase(),
			);
			if (!on && !off)
				return message.reply(buildMessage("Use `deduct on` or `deduct off`."));
			await prisma.guildInviteConfig.update({
				where: { guildId },
				data: { deductOnLeave: on },
			});
			return message.reply(
				buildMessage(`Deduct on leave: **${on ? "on" : "off"}**.`),
			);
		}

		if (setting === "toggle") {
			const next = !config.trackingEnabled;
			await prisma.guildInviteConfig.update({
				where: { guildId },
				data: { trackingEnabled: next },
			});
			return message.reply(
				buildMessage(`Invite tracking is now **${next ? "on" : "off"}**.`),
			);
		}

		return message.reply(
			buildMessage(
				`Unknown option \`${setting}\`. Use: channel, message, fakedays, deduct, toggle.`,
			),
		);
	},
};
