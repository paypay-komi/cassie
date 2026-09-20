const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "e4bebd8e-5d64-48b2-850a-d0f43c722a48",
	name: "iunmute",
	parent: "mod",
	description: "Remove the imute role from a member",
	aliases: ["textunmute"],
	usage: "mod iunmute <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to iunmute."));

		const cfg = await prisma.imuteConfig.findUnique({ where: { guildId: guild.id } });
		const reason = args.slice(1).join(" ") || "No reason provided";

		if (cfg?.roleId) {
			const had = target.roles.cache.has(cfg.roleId);
			await moderation.removeRole(guild, target, cfg.roleId, "Iunmuted");
			if (!had) return message.reply(buildMessage("That member is not imuted."));
		}

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "iunmute",
			reason,
		});

		return message.reply(buildMessage(`🔊 <@${target.id}> iunmuted (case #${modCase.caseNumber}).`, 0x57f287));
	},
};