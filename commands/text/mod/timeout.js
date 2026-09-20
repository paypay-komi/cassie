const { PermissionsBitField } = require("discord.js");
const ms = require("ms");
const { buildMessage } = require("../../../lib/v2Reply");
const moderation = require("../../../lib/moderation");

module.exports = {

commandId: "147a1f4c-9cd4-4cbd-935d-794f9d9f99d6",
	name: "timeout",
	parent: "mod",
	description: "Timeout (temporarily mute) a member",
	usage: "mod timeout <@user> <1h30m> [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const client = message.client;
		const prisma = client.db.prisma;
		const guild = message.guild;

		const target = message.mentions.members.first();
		if (!target) return message.reply(buildMessage("Mention a member to timeout."));
		if (target.communicationDisabledUntilTimestamp)
			return message.reply(buildMessage("That member is already timed out."));

		const duration = moderation.parseDuration(args[1]);
		if (!duration || duration < 60 || duration > 60 * 60 * 24 * 28)
			return message.reply(buildMessage("Provide a valid duration (min 1m, max 28d)."));

		const reason = args.slice(2).join(" ") || "No reason provided";

		try {
			await target.timeout(duration * 1000, `${message.author.tag}: ${reason}`);
		} catch (err) {
			return message.reply(buildMessage(`Failed to timeout: ${err.message}`, 0xe05252));
		}

		const modCase = await moderation.createCase({
			prisma,
			guildId: guild.id,
			moderatorId: message.author.id,
			targetId: target.id,
			type: "timeout",
			reason,
			duration,
		});

		await moderation.sendInvoke(client, guild, {
			command: "timeout",
			moderator: message.member,
			targetUser: target.user,
			reason,
			duration,
			caseNumber: modCase.caseNumber,
			channel: message.channel,
		});

		return message.reply(buildMessage(`⏲️ <@${target.id}> timed out for **${moderation.formatDuration(duration)}** (case #${modCase.caseNumber}).`, 0x5865f2));
	},
};