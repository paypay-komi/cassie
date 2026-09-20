const { PermissionsBitField, PermissionFlagsBits } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "667c634d-9fe3-4a3c-8cea-0893aca55968",
	name: "unlock",
	parent: "mod",
	description: "Unlock a channel (allow @everyone to send)",
	usage: "mod unlock [channel] [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],

	async execute(message, args) {
		const channel = message.mentions.channels.first() || message.channel;
		const reason =
			args.filter((a) => !/^<#\d+>$/.test(a)).join(" ") || "No reason provided";

		try {
			await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
				[PermissionFlagsBits.SendMessages]: true,
			});
			await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
				[PermissionFlagsBits.AddReactions]: true,
			});
		} catch (err) {
			return message.reply(buildMessage(`Failed to unlock: ${err.message}`, 0xe05252));
		}

		return message.reply(buildMessage(`🔓 ${channel} unlocked — ${reason}`, 0x57f287));
	},
};