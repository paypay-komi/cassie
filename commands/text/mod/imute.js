const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "72f1a8ef-43cc-43fe-af60-0eea22ccc2fb",
	name: "imute",
	parent: "mod",
	description: "Mute a member in all text channels (immute)",
	aliases: ["textmute"],
	usage: "mod imute <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to imute."));
		if (target.id === message.author.id) return message.reply(buildMessage("You cannot mute yourself."));

		const cfg = await prisma.imuteConfig.findUnique({ where: { guildId: guild.id } });
		if (!cfg?.roleId) return message.reply(buildMessage("No imute role configured. Run `mod roles imute <role>`."));
		if (target.roles.cache.has(cfg.roleId)) return message.reply(buildMessage("That member is already imuted."));

		const reason = args.slice(1).join(" ") || "No reason provided";

		const role = await moderation.applyRole(guild, target, cfg.roleId, "Imuted");
		if (!role) return message.reply(buildMessage("Could not apply the imute role (check hierarchy).", 0xe05252));

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "imute",
			reason,
		});

		await moderation.sendInvoke(client, guild, {
			command: "imute",
			moderator: message.member,
			targetUser: target.user,
			reason,
			caseNumber: modCase.caseNumber,
			channel: message.channel,
		});

		return message.reply(buildMessage(`🔇 <@${target.id}> imuted (case #${modCase.caseNumber}).`, 0x5865f2));
	},
};