const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "1b1d0526-698a-4715-9f18-61806c63004e",
	name: "kick",
	parent: "mod",
	description: "Kick a member from the server",
	usage: "mod kick <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.KickMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to kick."));
		if (target.id === message.author.id) return message.reply(buildMessage("You cannot kick yourself."));
		if (guild.members.me && target.roles.highest.position >= guild.members.me.roles.highest.position)
			return message.reply(buildMessage("That member is above me in the role hierarchy."));

		const reason = args.slice(1).join(" ") || "No reason provided";

		try {
			await target.kick(`${message.author.tag}: ${reason}`);
		} catch (err) {
			return message.reply(buildMessage(`Failed to kick: ${err.message}`, 0xe05252));
		}

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "kick",
			reason,
		});

		await moderation.sendInvoke(client, guild, {
			command: "kick",
			moderator: message.member,
			targetUser: target.user,
			reason,
			caseNumber: modCase.caseNumber,
			channel: message.channel,
		});

		return message.reply(buildMessage(`👢 <@${target.id}> was kicked (case #${modCase.caseNumber}).`, 0x5865f2));
	},
};