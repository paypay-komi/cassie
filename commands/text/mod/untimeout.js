const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "f8a8c8a7-779e-4978-874c-9e500a7528b9",
	name: "untimeout",
	parent: "mod",
	description: "Remove a timeout from a member",
	usage: "mod untimeout <@user> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to untimeout."));
		if (!target.communicationDisabledUntilTimestamp)
			return message.reply(buildMessage("That member is not timed out."));

		const reason = args.slice(1).join(" ") || "No reason provided";

		try {
			await target.timeout(null, `${message.author.tag}: ${reason}`);
		} catch (err) {
			return message.reply(buildMessage(`Failed to untimeout: ${err.message}`, 0xe05252));
		}

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "untimeout",
			reason,
		});

		return message.reply(buildMessage(`🟢 <@${target.id}> timeout removed (case #${modCase.caseNumber}).`, 0x5865f2));
	},
};