const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "f5014e83-c18a-4969-b999-7d52a3b95f90",
	name: "warn",
	parent: "mod",
	description: "Warn a member",
	usage: "mod warn <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to warn."));
		if (target.id === message.author.id) return message.reply(buildMessage("You cannot warn yourself."));

		const reason = args.slice(1).join(" ") || "No reason provided";

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "warn",
			reason,
		});

		await moderation.sendInvoke(client, guild, {
			command: "warn",
			moderator: message.member,
			targetUser: target.user,
			reason,
			caseNumber: modCase.caseNumber,
			channel: message.channel,
		});

		const punish = await moderation.escalateWarn(client, guild, target, reason);

		return message.reply(
			buildMessage(
				`⚠️ <@${target.id}> warned (case #${modCase.caseNumber}).${punish ? `\nThey reached **${punish.threshold}** warns — auto-applying \`${punish.action}\`.` : ""}`,
			),
			0x5865f2,
		);
	},
};