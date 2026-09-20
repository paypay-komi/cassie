const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "6d1199a4-09f5-427d-975e-7b3067531e75",
	name: "ban",
	parent: "mod",
	description: "Ban a member from the server",
	usage: "mod ban <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.BanMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to ban."));
		if (target.id === message.author.id) return message.reply(buildMessage("You cannot ban yourself."));
		if (guild.members.me && target.roles.highest.position >= guild.members.me.roles.highest.position)
			return message.reply(buildMessage("That member is above me in the role hierarchy."));

		const reason = args.slice(1).join(" ") || "No reason provided";

		try {
			await target.ban({ reason: `${message.author.tag}: ${reason}` });
		} catch (err) {
			return message.reply(buildMessage(`Failed to ban: ${err.message}`, 0xe05252));
		}

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "ban",
			reason,
		});

		await moderation.sendInvoke(client, guild, {
			command: "ban",
			moderator: message.member,
			targetUser: target.user,
			reason,
			caseNumber: modCase.caseNumber,
			channel: message.channel,
		});

		return message.reply(buildMessage(`🔨 <@${target.id}> was banned (case #${modCase.caseNumber}).`, 0x5865f2));
	},
};