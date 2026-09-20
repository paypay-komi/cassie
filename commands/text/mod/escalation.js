const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

const ACTIONS = ["timeout", "kick", "jail", "softban", "hardban", "ban"];

module.exports = {

commandId: "f960c172-cbe0-47ee-b8f4-9d5976480ac8",
	name: "escalation",
	parent: "mod",
	description: "Configure automatic punishments when a member hits warn thresholds",
	usage: "mod escalation list | mod escalation <count> <action> [duration] | mod escalation remove <count>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		if (args[0] === "list") {
			const punishments = await prisma.warnPunishment.findMany({
				where: { guildId: guild.id },
				orderBy: { threshold: "asc" },
			});
			if (!punishments.length)
				return message.reply(buildMessage("No escalation thresholds set.\nSet one with `mod escalation <count> <action> [duration]`."));

			const lines = [
				"## ⚠️ Escalation thresholds",
				...punishments.map((p) => `**${p.threshold} warns** → \`${p.action}\`${p.duration ? ` for ${p.duration}s` : ""}`),
			];
			return message.reply(buildMessage(lines.join("\n"), 0xe05252));
		}

		if (args[0] === "remove") {
			const threshold = parseInt(args[1], 10);
			if (!threshold) return message.reply(buildMessage("Provide a threshold count."));
			await prisma.warnPunishment.deleteMany({ where: { guildId: guild.id, threshold } });
			return message.reply(buildMessage(`Removed escalation at ${threshold} warns.`));
		}

		const threshold = parseInt(args[0], 10);
		const action = args[1];
		const duration = args[2] ? require("../../../lib/moderation").parseDuration(args[2]) : null;

		if (!threshold || threshold < 1) return message.reply(buildMessage("Provide a threshold count (≥1)."));
		if (!action || !ACTIONS.includes(action))
			return message.reply(buildMessage(`Valid actions: ${ACTIONS.join(", ")}`));
		if (action === "timeout" && !duration)
			return message.reply(buildMessage("`timeout` action requires a duration, e.g. `mod escalation 3 timeout 1h`."));

		await prisma.warnPunishment.upsert({
			where: { guildId_threshold: { guildId: guild.id, threshold } },
			create: { guildId: guild.id, threshold, action, duration },
			update: { action, duration },
		});

		return message.reply(
			buildMessage(
				`Escalation set: **${threshold} warns** → \`${action}\`${duration ? ` for ${require("../../../lib/moderation").formatDuration(duration)}` : ""}.`,
				0x57f287,
			),
		);
	},
};