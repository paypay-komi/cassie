const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "373e3e2f-570b-4864-9080-b74e176a2257",
	name: "rmute",
	parent: "mod",
	description: "Mute a member in all voice channels",
	aliases: ["voicemute"],
	usage: "mod rmute <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to rmute."));
		if (target.id === message.author.id) return message.reply(buildMessage("You cannot mute yourself."));

		const cfg = await prisma.rmuteConfig.findUnique({ where: { guildId: guild.id } });
		if (!cfg?.roleId) return message.reply(buildMessage("No rmute role configured. Run `mod roles rmute <role>`."));
		if (target.roles.cache.has(cfg.roleId)) return message.reply(buildMessage("That member is already rmuted."));

		const reason = args.slice(1).join(" ") || "No reason provided";

		const role = await moderation.applyRole(guild, target, cfg.roleId, "Rmuted");
		if (!role) return message.reply(buildMessage("Could not apply the rmute role (check hierarchy).", 0xe05252));

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "rmute",
			reason,
		});

		await moderation.sendInvoke(client, guild, {
			command: "rmute",
			moderator: message.member,
			targetUser: target.user,
			reason,
			caseNumber: modCase.caseNumber,
			channel: message.channel,
		});

		return message.reply(buildMessage(`🎙️ <@${target.id}> rmuted (case #${modCase.caseNumber}).`, 0x5865f2));
	},
};