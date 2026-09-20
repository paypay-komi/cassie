const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "6968c35b-9d81-4a2e-9780-011423293392",
	name: "add",
	parent: "invites",
	description: "Add or remove invites for a user (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;

		const target = message.mentions.users.first();
		const amount = parseInt(args[1], 10);

		if (!target)
			return message.reply(
				buildMessage("Usage: `c.invites add @user <amount>` (negative to remove)"),
			);
		if (isNaN(amount) || amount === 0)
			return message.reply(buildMessage("Provide a non-zero amount."));

		const row = await prisma.inviteAdjustment.upsert({
			where: { guildId_userId: { guildId, userId: target.id } },
			update: { amount: { increment: amount } },
			create: { guildId, userId: target.id, amount },
		});

		return message.reply(
			buildMessage(
				`✅ Adjusted ${target}'s invite count by **${
					amount > 0 ? "+" : ""
				}${amount}** (adjustment now **${row.amount}**).`,
			),
		);
	},
};
