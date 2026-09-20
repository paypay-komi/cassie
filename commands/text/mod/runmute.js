const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "04c8f4ac-9242-4d6c-b31e-0eff6a7a8753",
	name: "runmute",
	parent: "mod",
	description: "Remove the rmute role from a member",
	aliases: ["voiceunmute"],
	usage: "mod runmute <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to runmute."));

		const cfg = await prisma.rmuteConfig.findUnique({ where: { guildId: guild.id } });
		const reason = args.slice(1).join(" ") || "No reason provided";

		if (cfg?.roleId) {
			const had = target.roles.cache.has(cfg.roleId);
			await moderation.removeRole(guild, target, cfg.roleId, "Runmuted");
			if (!had) return message.reply(buildMessage("That member is not rmuted."));
		}

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "runmute",
			reason,
		});

		return message.reply(buildMessage(`🎙️ <@${target.id}> runmuted (case #${modCase.caseNumber}).`, 0x57f287));
	},
};