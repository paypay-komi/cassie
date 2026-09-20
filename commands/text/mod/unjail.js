const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "d9e1cc01-fc36-4817-a21d-9fe828bbcaf4",
	name: "unjail",
	parent: "mod",
	description: "Release a member from jail",
	usage: "mod unjail <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to unjail."));

		const cfg = await prisma.jailConfig.findUnique({ where: { guildId: guild.id } });
		const reason = args.slice(1).join(" ") || "No reason provided";

		if (cfg?.roleId) {
			const had = target.roles.cache.has(cfg.roleId);
			await moderation.removeRole(guild, target, cfg.roleId, "Unjailed");
			if (!had) return message.reply(buildMessage("That member is not jailed."));
		} else {
			if (!target.roles.cache.size) return message.reply(buildMessage("That member has no jail role."));
		}

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "unjail",
			reason,
		});

		return message.reply(buildMessage(`🔓 <@${target.id}> unjailed (case #${modCase.caseNumber}).`, 0x57f287));
	},
};