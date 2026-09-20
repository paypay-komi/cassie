const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "50e7ed97-75e8-4c81-96d1-afeaaa74779d",
	name: "reward",
	parent: "levels",
	description: "Manage level role rewards (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;
		const role = message.mentions.roles.first();
		const level = parseInt(args[1], 10);

		if (!role) {
			const rows = await prisma.levelRoleReward.findMany({
				where: { guildId },
				orderBy: { level: "asc" },
			});
			if (!rows.length)
				return message.reply(
					buildMessage(
						"No rewards set. Usage: `c.levels reward @role <level>` (0 removes).",
					),
				);
			return message.reply(
				buildMessage(
					[
						"## 🎁 Reward Roles",
						...rows.map((r) => `Level **${r.level}** → <@&${r.roleId}>`),
					].join("\n"),
					0x57f287,
				),
			);
		}

		if (isNaN(level))
			return message.reply(
				buildMessage("Provide a level (0 removes the role's reward)."),
			);

		if (level <= 0) {
			await prisma.levelRoleReward.deleteMany({
				where: { guildId, roleId: role.id },
			});
			return message.reply(buildMessage(`Removed reward for ${role}.`));
		}

		await prisma.levelRoleReward.deleteMany({
			where: { guildId, OR: [{ level }, { roleId: role.id }] },
		});
		await prisma.levelRoleReward.create({
			data: { guildId, roleId: role.id, level },
		});
		return message.reply(
			buildMessage(`Members reaching level **${level}** now get ${role}.`),
		);
	},
};
