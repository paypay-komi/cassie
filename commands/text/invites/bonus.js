const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "5f3c72ec-603b-4e09-a8b0-958705e206c7",
	name: "bonus",
	parent: "invites",
	description: "Manage role-based invite bonuses (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;
		const role = message.mentions.roles.first();

		if (!role) {
			const rows = await prisma.inviteBonus.findMany({
				where: { guildId },
			});
			if (!rows.length)
				return message.reply(
					buildMessage(
						"No role bonuses set. Usage: `c.invites bonus @role <amount>` (0 removes).",
					),
				);
			const lines = [
				"## 🎁 Invite Bonuses",
				...rows.map((r) => `<@&${r.roleId}> — +${r.bonus}`),
			];
			return message.reply(buildMessage(lines.join("\n"), 0x57f287));
		}

		const amount = parseInt(args[1], 10);
		if (isNaN(amount))
			return message.reply(
				buildMessage("Provide an amount (0 removes the bonus)."),
			);

		if (amount <= 0) {
			await prisma.inviteBonus.deleteMany({
				where: { guildId, roleId: role.id },
			});
			return message.reply(buildMessage(`Removed invite bonus for ${role}.`));
		}

		await prisma.inviteBonus.upsert({
			where: { guildId_roleId: { guildId, roleId: role.id } },
			update: { bonus: amount },
			create: { guildId, roleId: role.id, bonus: amount },
		});
		return message.reply(
			buildMessage(`Members with ${role} now get **+${amount}** bonus invite(s).`),
		);
	},
};
