const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "898ee242-1e54-416c-b105-6eea1aa98c0e",
	name: "ignore",
	parent: "levels",
	description: "Ignore channels/roles for XP (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;

		const role = message.mentions.roles.first();
		const channel = message.mentions.channels.first();
		const target = role
			? { id: role.id, type: "role" }
			: channel
				? { id: channel.id, type: "channel" }
				: null;

		if (!target) {
			const rows = await prisma.levelIgnore.findMany({
				where: { guildId },
			});
			if (!rows.length)
				return message.reply(
					buildMessage("Nothing ignored. Mention a channel or role to toggle."),
				);
			const lines = rows.map((r) =>
				r.targetType === "role" ? `<@&${r.targetId}>` : `<#${r.targetId}>`,
			);
			return message.reply(
				buildMessage(["## 🚫 Ignored", ...lines].join("\n"), 0xed4245),
			);
		}

		const existing = await prisma.levelIgnore.findUnique({
			where: {
				guildId_targetId_targetType: {
					guildId,
					targetId: target.id,
					targetType: target.type,
				},
			},
		});
		const label =
			target.type === "role" ? `<@&${target.id}>` : `<#${target.id}>`;

		if (existing) {
			await prisma.levelIgnore.delete({ where: { id: existing.id } });
			return message.reply(buildMessage(`${label} will now grant XP.`));
		}

		await prisma.levelIgnore.create({
			data: { guildId, targetId: target.id, targetType: target.type },
		});
		return message.reply(buildMessage(`${label} will no longer grant XP.`));
	},
};
