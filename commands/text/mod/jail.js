const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "3a791202-a7ca-43fd-9eb9-d37694314a41",
	name: "jail",
	parent: "mod",
	description: "Jail a member by assigning the jail role",
	usage: "mod jail <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to jail."));
		if (target.id === message.author.id) return message.reply(buildMessage("You cannot jail yourself."));

		const cfg = await prisma.jailConfig.findUnique({ where: { guildId: guild.id } });
		if (!cfg?.roleId) return message.reply(buildMessage("No jail role configured. Run `mod roles jail <role>`."));
		if (target.roles.cache.has(cfg.roleId))
			return message.reply(buildMessage("That member is already jailed."));

		const reason = args.slice(1).join(" ") || "No reason provided";

		const role = await moderation.applyRole(guild, target, cfg.roleId, "Jailed");
		if (!role) return message.reply(buildMessage("Could not apply the jail role (check hierarchy).", 0xe05252));

		if (cfg.channelId && target.voice?.channelId) {
			await target.voice.setChannel(cfg.channelId).catch(() => {});
		}

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "jail",
			reason,
		});

		await moderation.sendInvoke(client, guild, {
			command: "jail",
			moderator: message.member,
			targetUser: target.user,
			reason,
			caseNumber: modCase.caseNumber,
			channel: message.channel,
		});

		return message.reply(buildMessage(`🔒 <@${target.id}> jailed (case #${modCase.caseNumber}).`, 0x5865f2));
	},
};