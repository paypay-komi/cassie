const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "7f3638f7-b4c3-466f-a5fa-b9f07a6b66c6",
	name: "multiplier",
	parent: "levels",
	description: "Manage XP multipliers for roles/channels (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;

		const role = message.mentions.roles.first();
		const channel = message.mentions.channels.first();
		const target = role
			? { id: role.id, type: "role" }
			: channel
				? { id: channel.id, type: "channel" }
				: null;
		const mult = parseFloat(args[1]);

		if (!target) {
			const rows = await prisma.levelMultiplier.findMany({
				where: { guildId },
			});
			if (!rows.length)
				return message.reply(
					buildMessage(
						"No multipliers set. Usage: `c.levels multiplier @role <n>` or `#channel <n>` (0 removes).",
					),
				);
			const lines = rows.map((r) =>
				r.targetType === "role"
					? `<@&${r.targetId}> — ${r.multiplier}x`
					: `<#${r.targetId}> — ${r.multiplier}x`,
			);
			return message.reply(
				buildMessage(["## ✖️ XP Multipliers", ...lines].join("\n"), 0x5865f2),
			);
		}

		if (isNaN(mult))
			return message.reply(buildMessage("Provide a multiplier (0 removes)."));

		if (mult <= 0) {
			await prisma.levelMultiplier.deleteMany({
				where: { guildId, targetId: target.id, targetType: target.type },
			});
			return message.reply(buildMessage("Removed multiplier."));
		}

		await prisma.levelMultiplier.upsert({
			where: {
				guildId_targetId_targetType: {
					guildId,
					targetId: target.id,
					targetType: target.type,
				},
			},
			update: { multiplier: mult },
			create: {
				guildId,
				targetId: target.id,
				targetType: target.type,
				multiplier: mult,
			},
		});

		const label =
			target.type === "role" ? `<@&${target.id}>` : `<#${target.id}>`;
		return message.reply(buildMessage(`${label} now gives **${mult}x** XP.`));
	},
};
