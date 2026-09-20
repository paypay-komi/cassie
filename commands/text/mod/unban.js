const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "bd3f57e6-7c14-4c7d-b781-d7599a336f47",
	name: "unban",
	parent: "mod",
	description: "Unban a user by ID",
	usage: "mod unban <userID> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.BanMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;

		const targetId = (message.mentions.users.first()?.id) || (args[0] && /^\d+$/.test(args[0]) ? args[0] : null);
		if (!targetId) return message.reply(buildMessage("Provide a user ID to unban."));

		const reason = args.slice(1).join(" ") || "No reason provided";

		try {
			await guild.members.unban(targetId, `${message.author.tag}: ${reason}`);
		} catch (err) {
			return message.reply(buildMessage(`Failed to unban: ${err.message}`, 0xe05252));
		}

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId,
			type: "unban",
			reason,
		});

		return message.reply(buildMessage(`🕊️ <@${targetId}> was unbanned (case #${modCase.caseNumber}).`, 0x5865f2));
	},
};