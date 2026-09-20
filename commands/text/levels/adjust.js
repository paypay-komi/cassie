const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const levels = require("../../../lib/levels");

module.exports = {

commandId: "81f46222-c895-4b73-a4d4-7d61447ffb39",
	name: "adjust",
	parent: "levels",
	description: "Add or remove XP for a user (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;
		const target = message.mentions.users.first();
		const amount = parseInt(args[1], 10);

		if (!target)
			return message.reply(
				buildMessage("Usage: `c.levels adjust @user <amount>` (negative to remove)."),
			);
		if (isNaN(amount) || amount === 0)
			return message.reply(buildMessage("Provide a non-zero amount."));

		const m = await levels.getMember(prisma, guildId, target.id);
		let newXp = m.xp + BigInt(amount);
		if (newXp < 0n) newXp = 0n;
		const prog = levels.levelFromXp(newXp);

		await prisma.memberXP.update({
			where: { guildId_userId: { guildId, userId: target.id } },
			data: { xp: newXp, level: prog.level },
		});

		return message.reply(
			buildMessage(
				`✅ Adjusted ${target}'s XP by **${
					amount > 0 ? "+" : ""
				}${amount}** (now level **${prog.level}**, **${newXp}** XP).`,
			),
		);
	},
};
