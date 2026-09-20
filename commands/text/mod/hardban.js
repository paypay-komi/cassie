const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "bbd9fca6-d765-4c51-811c-5f6eb38a62d9",
	name: "hardban",
	parent: "mod",
	description: "Ban a member and delete their messages",
	usage: "mod hardban <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.BanMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to hardban."));
		if (target.id === message.author.id) return message.reply(buildMessage("You cannot ban yourself."));

		const reason = args.slice(1).join(" ") || "No reason provided";

		try {
			await target.ban({ deleteMessageSeconds: 60 * 60 * 24 * 7, reason: `${message.author.tag}: ${reason}` });
		} catch (err) {
			return message.reply(buildMessage(`Failed to hardban: ${err.message}`, 0xe05252));
		}

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "hardban",
			reason,
		});

		await moderation.sendInvoke(client, guild, {
			command: "hardban",
			moderator: message.member,
			targetUser: target.user,
			reason,
			caseNumber: modCase.caseNumber,
			channel: message.channel,
		});

		return message.reply(buildMessage(`♻️ <@${target.id}> hardbanned — messages deleted (case #${modCase.caseNumber}).`, 0x5865f2));
	},
};