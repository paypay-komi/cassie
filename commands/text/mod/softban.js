const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "fd409688-2a9f-4e3c-9c7d-df977e31b91d",
	name: "softban",
	parent: "mod",
	description: "Ban a member, delete messages, then unban",
	usage: "mod softban <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.BanMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to softban."));
		if (target.id === message.author.id) return message.reply(buildMessage("You cannot ban yourself."));

		const reason = args.slice(1).join(" ") || "No reason provided";

		try {
			await target.ban({ deleteMessageSeconds: 60 * 60 * 24 * 7, reason: `${message.author.tag}: ${reason}` });
			await guild.members.unban(target.id, "Softban complete");
		} catch (err) {
			return message.reply(buildMessage(`Failed to softban: ${err.message}`, 0xe05252));
		}

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "softban",
			reason,
		});

		await moderation.sendInvoke(client, guild, {
			command: "softban",
			moderator: message.member,
			targetUser: target.user,
			reason,
			caseNumber: modCase.caseNumber,
			channel: message.channel,
		});

		return message.reply(buildMessage(`🧹 <@${target.id}> softbanned — messages deleted (case #${modCase.caseNumber}).`, 0x5865f2));
	},
};