const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "789511aa-5801-4529-bb4b-0d1beb25847f",
	name: "reset",
	parent: "invites",
	description: "Reset invite data (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;
		const target = message.mentions.users.first();

		if (target) {
			const invites = await prisma.invite.findMany({
				where: { guildId, inviterId: target.id },
				select: { id: true },
			});
			const ids = invites.map((i) => i.id);
			if (ids.length) {
				await prisma.inviteJoin.deleteMany({
					where: { guildId, inviteId: { in: ids } },
				});
			}
			await prisma.invite.deleteMany({
				where: { guildId, inviterId: target.id },
			});
			await prisma.inviteAdjustment.deleteMany({
				where: { guildId, userId: target.id },
			});
			return message.reply(buildMessage(`♻️ Reset invite data for ${target}.`));
		}

		await prisma.inviteJoin.deleteMany({ where: { guildId } });
		await prisma.invite.deleteMany({ where: { guildId } });
		await prisma.inviteAdjustment.deleteMany({ where: { guildId } });
		return message.reply(buildMessage("♻️ Reset all invite data for this server."));
	},
};
